-- Revoke outstanding bearer-token invitations without enumerating or
-- revealing the token IDs. AAL2 and same-organization membership required.
ALTER TABLE public.organization_invites
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
CREATE INDEX IF NOT EXISTS tercis_org_pending_invite_lookup
  ON public.organization_invites(organization_id,lower(email),created_at DESC)
  WHERE used_at IS NULL AND revoked_at IS NULL;

CREATE OR REPLACE FUNCTION public.tercis_revoke_organization_invites(
  p_email text
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_org uuid; v_actor uuid:=auth.uid(); v_total integer;
DECLARE v_normalized text:=lower(btrim(coalesce(p_email,'')));
BEGIN
  IF NOT public.tercis_verified_aal2() THEN
    RAISE EXCEPTION 'Revogar convites exige MFA verificado.'
      USING ERRCODE='42501';
  END IF;
  SELECT organization_id INTO v_org FROM public.profiles
  WHERE id=v_actor AND active IS TRUE AND role IN ('admin','company_admin');
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Apenas administradores da organização podem revogar convites.'
      USING ERRCODE='42501';
  END IF;
  IF v_normalized !~ '^[^ @]+@[^ @]+[.][^ @]+$' OR length(v_normalized)>254 THEN
    RAISE EXCEPTION 'Email de convite inválido.' USING ERRCODE='22023';
  END IF;
  UPDATE public.organization_invites
  SET revoked_at=now()
  WHERE organization_id=v_org AND lower(email)=v_normalized
    AND used_at IS NULL AND revoked_at IS NULL
    AND expires_at>now();
  GET DIAGNOSTICS v_total=ROW_COUNT;
  INSERT INTO public.audit_logs(
    organization_id,actor_id,entity_type,action,metadata
  ) VALUES(
    v_org,v_actor,'organization_invite','invites_revoked',
    jsonb_build_object('count',v_total)
  );
  RETURN v_total;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_revoke_organization_invites(text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_revoke_organization_invites(text)
  TO authenticated;

-- Existing invitation redemption is one-use; enforce revocation before it
-- is consumed, in addition to used_at and expires_at checks.
CREATE OR REPLACE FUNCTION public.tercis_accept_organization_invite(
  p_token uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_actor uuid:=auth.uid();v_profile public.profiles%ROWTYPE;
DECLARE v_invite public.organization_invites%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR p_token IS NULL THEN
    RAISE EXCEPTION 'Convite inválido.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_invite FROM public.organization_invites
    WHERE id=p_token FOR UPDATE;
  IF NOT FOUND OR v_invite.used_at IS NOT NULL OR
    v_invite.revoked_at IS NOT NULL OR v_invite.expires_at<=now() THEN
    RAISE EXCEPTION 'Convite inválido, revogado ou expirado.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id=v_actor FOR UPDATE;
  IF NOT FOUND OR v_profile.organization_id IS NOT NULL OR
     v_profile.active IS TRUE OR v_profile.role<>'client' OR
     lower(v_profile.email) IS DISTINCT FROM v_invite.email OR
     NOT EXISTS (
       SELECT 1 FROM auth.users u WHERE u.id=v_actor
         AND lower(u.email)=v_invite.email AND u.email_confirmed_at IS NOT NULL
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

-- Profile trigger must not allow attaching a revoked invitation ID directly.
CREATE OR REPLACE FUNCTION public.tercis_refuse_revoked_invitation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.invitation_id IS NOT NULL
    AND (TG_OP='INSERT' OR NEW.invitation_id IS DISTINCT FROM OLD.invitation_id)
    AND EXISTS(
      SELECT 1 FROM public.organization_invites i
      WHERE i.id=NEW.invitation_id AND i.revoked_at IS NOT NULL
    ) THEN
    RAISE EXCEPTION 'Convite revogado.' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tercis_refuse_revoked_invitation ON public.profiles;
CREATE TRIGGER tercis_refuse_revoked_invitation
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tercis_refuse_revoked_invitation();
REVOKE ALL ON FUNCTION public.tercis_refuse_revoked_invitation()
  FROM PUBLIC,anon,authenticated;
