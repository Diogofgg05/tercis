
/*
  Secure tenant invitation and acceptance. An unassigned signup cannot choose
  an organization without a one-time invitation from its administrator.
  The invite token is a cryptographically random UUID capability (122 bits).
  Require Supabase email confirmation to be enabled for hosted deployment.
*/

CREATE TABLE public.organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  email text NOT NULL,
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',
  used_at timestamptz,
  CONSTRAINT tercis_invite_email_nonempty CHECK (length(btrim(email)) > 3)
);
CREATE INDEX IF NOT EXISTS tercis_org_invites_org_email_idx
  ON public.organization_invites(organization_id,lower(email));
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.organization_invites FROM PUBLIC,anon,authenticated;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS invitation_id uuid REFERENCES public.organization_invites(id);

CREATE OR REPLACE FUNCTION public.tercis_create_organization_invite(
  p_email text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_actor uuid:=auth.uid(); v_org uuid; v_token uuid;
BEGIN
  SELECT organization_id INTO v_org FROM public.profiles
  WHERE id=v_actor AND active IS TRUE AND role='admin';
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Apenas administradores autorizados podem emitir convites.'
      USING ERRCODE='42501';
  END IF;
  IF p_email IS NULL OR length(btrim(p_email))>254 OR
     lower(btrim(p_email)) !~ '^[^ @]+@[^ @]+\\.[^ @]+$' THEN
    RAISE EXCEPTION 'Email de convite inválido.' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.organization_invites(organization_id,email,invited_by)
  VALUES(v_org,lower(btrim(p_email)),v_actor)
  RETURNING id INTO v_token;
  INSERT INTO public.audit_logs(
    organization_id,actor_id,entity_type,entity_id,action
  ) VALUES(v_org,v_actor,'organization_invite',v_token,'invite_created');
  RETURN v_token;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_create_organization_invite(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_create_organization_invite(text) TO authenticated;

-- A profile may join an organization exactly once, only via a valid one-time
-- invitation for its own verified email, while inactive.
CREATE OR REPLACE FUNCTION public.tercis_guard_profile_organization()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF TG_OP='UPDATE' AND auth.uid() IS NOT NULL
    AND NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    IF OLD.organization_id IS NOT NULL OR OLD.active IS TRUE OR
       NEW.id IS DISTINCT FROM auth.uid() OR NEW.role<>'client' OR
       NEW.invitation_id IS NULL OR
       NOT EXISTS (
         SELECT 1 FROM public.organization_invites i
         WHERE i.id=NEW.invitation_id AND i.organization_id=NEW.organization_id
           AND i.email=lower(NEW.email)
           AND i.used_at IS NULL AND i.expires_at>now()
       )
    THEN
      RAISE EXCEPTION 'A organização só pode ser atribuída por convite válido.'
        USING ERRCODE='42501';
    END IF;
  END IF;
  IF NEW.role='app_admin' AND NEW.organization_id IS NOT NULL THEN
    RAISE EXCEPTION 'A administração da plataforma não pertence a tenants comerciais.'
      USING ERRCODE='42501';
  END IF;
  IF NEW.company_id IS NOT NULL AND (
    NEW.organization_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id=NEW.company_id AND c.organization_id=NEW.organization_id
    )
  ) THEN
    RAISE EXCEPTION 'Empresa cliente do perfil fora da organização.' USING ERRCODE='42501';
  END IF;
  IF NEW.customer_type_id IS NOT NULL AND (
    NEW.organization_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.customer_types t
      JOIN public.companies c ON c.id=t.company_id
      WHERE t.id=NEW.customer_type_id AND c.organization_id=NEW.organization_id
    )
  ) THEN
    RAISE EXCEPTION 'Tipo de cliente do perfil fora da organização.'
      USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tercis_accept_organization_invite(
  p_token uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_actor uuid:=auth.uid(); v_profile public.profiles%ROWTYPE;
DECLARE v_invite public.organization_invites%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR p_token IS NULL THEN
    RAISE EXCEPTION 'Convite inválido.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_invite FROM public.organization_invites
  WHERE id=p_token FOR UPDATE;
  IF NOT FOUND OR v_invite.used_at IS NOT NULL OR v_invite.expires_at<=now() THEN
    RAISE EXCEPTION 'Convite inválido ou expirado.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id=v_actor FOR UPDATE;
  IF NOT FOUND OR v_profile.organization_id IS NOT NULL OR
     v_profile.active IS TRUE OR v_profile.role<>'client' OR
     lower(v_profile.email) IS DISTINCT FROM v_invite.email OR
     NOT EXISTS (
       SELECT 1 FROM auth.users u WHERE u.id=v_actor AND
         lower(u.email)=v_invite.email AND u.email_confirmed_at IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'O convite não corresponde a esta conta verificada.'
      USING ERRCODE='42501';
  END IF;
  UPDATE public.profiles
  SET organization_id=v_invite.organization_id,invitation_id=p_token
  WHERE id=v_actor;
  UPDATE public.organization_invites SET used_at=now() WHERE id=p_token;
  INSERT INTO public.audit_logs(
    organization_id,actor_id,entity_type,entity_id,action
  ) VALUES(v_invite.organization_id,v_actor,'organization_invite',p_token,'invite_accepted');
  RETURN v_invite.organization_id;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_accept_organization_invite(uuid)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_accept_organization_invite(uuid)
  TO authenticated;
