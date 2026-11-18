/*
 * Phase 28 — consent-based multi-tenant commercial links.
 * Company entries remain local to their owning tenant. A link proves only a
 * consensual business relationship; it NEVER grants access to another
 * organization's budgets, catalog, private attachments, contacts or users.
 * No direct browser table permissions are granted; RPCs are the sole interface.
 */
CREATE TABLE IF NOT EXISTS public.tercis_business_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owning_organization_id uuid NOT NULL REFERENCES public.organizations(id),
  local_company_id uuid NOT NULL REFERENCES public.companies(id),
  partner_organization_id uuid REFERENCES public.organizations(id),
  relationship_type text NOT NULL CHECK (relationship_type IN ('client','supplier','both')),
  secret_hash text NOT NULL UNIQUE CHECK (length(secret_hash)=64),
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  accepted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now()+interval '7 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  CONSTRAINT tercis_link_not_self CHECK (
    partner_organization_id IS NULL OR partner_organization_id<>owning_organization_id
  ),
  CONSTRAINT tercis_link_acceptance_consistent CHECK (
    (partner_organization_id IS NULL AND accepted_at IS NULL AND accepted_by IS NULL)
    OR (partner_organization_id IS NOT NULL AND accepted_at IS NOT NULL AND accepted_by IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS tercis_business_links_owner_idx
  ON public.tercis_business_links(owning_organization_id,created_at DESC);
CREATE INDEX IF NOT EXISTS tercis_business_links_partner_idx
  ON public.tercis_business_links(partner_organization_id,accepted_at DESC)
  WHERE partner_organization_id IS NOT NULL;
-- Only one active, accepted connection between two organizations for a local
-- company and commercial role. A revoked link can be re-established.
CREATE UNIQUE INDEX IF NOT EXISTS tercis_business_link_active_pair_idx
  ON public.tercis_business_links(
    owning_organization_id,local_company_id,partner_organization_id,relationship_type
  ) WHERE accepted_at IS NOT NULL AND revoked_at IS NULL;
ALTER TABLE public.tercis_business_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tercis_business_links FROM PUBLIC,anon,authenticated;

-- Even service-role or a future migration must not bind a local company to
-- another organization's account by mistake.
CREATE OR REPLACE FUNCTION public.tercis_guard_business_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM public.companies c
    WHERE c.id=NEW.local_company_id
      AND c.organization_id=NEW.owning_organization_id
  ) THEN
    RAISE EXCEPTION 'A ficha comercial não pertence à organização proprietária.'
      USING ERRCODE='42501';
  END IF;
  IF TG_OP='UPDATE' AND (
    NEW.owning_organization_id IS DISTINCT FROM OLD.owning_organization_id
    OR NEW.local_company_id IS DISTINCT FROM OLD.local_company_id
    OR NEW.secret_hash IS DISTINCT FROM OLD.secret_hash
    OR NEW.relationship_type IS DISTINCT FROM OLD.relationship_type
  ) THEN
    RAISE EXCEPTION 'Uma ligação comercial não pode ser transferida.'
      USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tercis_guard_business_link_write
  ON public.tercis_business_links;
CREATE TRIGGER tercis_guard_business_link_write
  BEFORE INSERT OR UPDATE ON public.tercis_business_links
  FOR EACH ROW EXECUTE FUNCTION public.tercis_guard_business_link();
REVOKE ALL ON FUNCTION public.tercis_guard_business_link()
  FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.tercis_create_business_link_invite(
  p_company_id uuid,p_relationship_type text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE
  v_actor uuid:=auth.uid();
  v_org uuid;
  v_token uuid:=gen_random_uuid();
  v_link uuid;
BEGIN
  SELECT organization_id INTO v_org FROM public.profiles
  WHERE id=v_actor AND active IS TRUE
    AND role IN ('admin','company_admin');
  IF v_org IS NULL OR NOT public.tercis_verified_aal2() THEN
    RAISE EXCEPTION 'Esta ação exige administração da empresa e MFA verificado.'
      USING ERRCODE='42501';
  END IF;
  IF p_relationship_type IS NULL
    OR p_relationship_type NOT IN ('client','supplier','both')
  THEN
    RAISE EXCEPTION 'Relação comercial inválida.' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id=p_company_id AND c.organization_id=v_org AND c.active IS DISTINCT FROM FALSE
  ) THEN
    RAISE EXCEPTION 'Cliente ou fornecedor não encontrado nesta organização.'
      USING ERRCODE='42501';
  END IF;
  INSERT INTO public.tercis_business_links(
    owning_organization_id,local_company_id,relationship_type,
    secret_hash,invited_by
  ) VALUES (
    v_org,p_company_id,p_relationship_type,
    encode(sha256(convert_to(v_token::text,'UTF8')),'hex'),v_actor
  ) RETURNING id INTO v_link;
  INSERT INTO public.audit_logs(organization_id,actor_id,entity_type,entity_id,action)
    VALUES (v_org,v_actor,'business_link',v_link,'invite_created');
  RETURN v_token; -- never stored in plaintext; display once.
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_create_business_link_invite(uuid,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_create_business_link_invite(uuid,text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.tercis_accept_business_link_invite(p_token uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE
  v_org uuid;
  v_actor uuid:=auth.uid();
  v_link public.tercis_business_links%ROWTYPE;
BEGIN
  SELECT organization_id INTO v_org FROM public.profiles
  WHERE id=v_actor AND active IS TRUE
    AND role IN ('admin','company_admin');
  IF v_org IS NULL OR NOT public.tercis_verified_aal2() THEN
    RAISE EXCEPTION 'Aceitar a ligação exige administração da empresa e MFA verificado.'
      USING ERRCODE='42501';
  END IF;
  IF p_token IS NULL THEN
    RAISE EXCEPTION 'Convite inválido.' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_link FROM public.tercis_business_links
  WHERE secret_hash=encode(sha256(convert_to(p_token::text,'UTF8')),'hex')
  FOR UPDATE;
  IF NOT FOUND OR v_link.revoked_at IS NOT NULL
    OR v_link.accepted_at IS NOT NULL OR v_link.expires_at<=now()
    OR v_link.owning_organization_id=v_org THEN
    RAISE EXCEPTION 'Convite inválido, expirado, já utilizado ou da própria empresa.'
      USING ERRCODE='42501';
  END IF;
  -- The recipient consents ONLY to an organization-level relationship.
  -- Their users, directory, documents and assets remain inaccessible.
  IF EXISTS (
    SELECT 1 FROM public.tercis_business_links l
    WHERE l.owning_organization_id=v_link.owning_organization_id
      AND l.local_company_id=v_link.local_company_id
      AND l.partner_organization_id=v_org
      AND l.relationship_type=v_link.relationship_type
      AND l.accepted_at IS NOT NULL AND l.revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Esta relação entre empresas já está ativa.'
      USING ERRCODE='23505';
  END IF;
  UPDATE public.tercis_business_links SET
    partner_organization_id=v_org,accepted_at=now(),accepted_by=v_actor
  WHERE id=v_link.id;
  INSERT INTO public.audit_logs(
    organization_id,actor_id,entity_type,entity_id,action
  ) VALUES(v_org,v_actor,'business_link',v_link.id,'invite_accepted');
  RETURN v_link.id;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_accept_business_link_invite(uuid)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_accept_business_link_invite(uuid)
  TO authenticated;

-- Return ONLY organization display names after mutual consent. Pending links
-- are visible only to the initiating organization. The recipient receives
-- neither the local customer UUID nor its address, contacts or notes.
CREATE OR REPLACE FUNCTION public.tercis_list_business_links()
RETURNS TABLE (
  id uuid, local_company_id uuid, local_company_name text,
  partner_name text, relationship_type text, status text,
  owned_by_me boolean, created_at timestamptz, expires_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_org uuid;
BEGIN
  SELECT organization_id INTO v_org FROM public.profiles
  WHERE id=auth.uid() AND active IS TRUE
    AND role IN ('admin','company_admin');
  IF v_org IS NULL OR NOT public.tercis_verified_aal2() THEN
    RAISE EXCEPTION 'A lista de ligações exige administração e MFA.'
      USING ERRCODE='42501';
  END IF;
  RETURN QUERY
  SELECT l.id,
    CASE WHEN l.owning_organization_id=v_org THEN l.local_company_id ELSE NULL END,
    CASE WHEN l.owning_organization_id=v_org THEN c.name ELSE NULL END,
    CASE WHEN l.owning_organization_id=v_org THEN partner.name ELSE owner_org.name END,
    l.relationship_type,
    CASE WHEN l.revoked_at IS NOT NULL THEN 'revoked'
      WHEN l.accepted_at IS NOT NULL THEN 'active'
      WHEN l.expires_at<=now() THEN 'expired'
      ELSE 'pending' END,
    l.owning_organization_id=v_org,
    l.created_at,l.expires_at
  FROM public.tercis_business_links l
  JOIN public.companies c ON c.id=l.local_company_id
  JOIN public.organizations owner_org ON owner_org.id=l.owning_organization_id
  LEFT JOIN public.organizations partner ON partner.id=l.partner_organization_id
  WHERE l.owning_organization_id=v_org
    OR (l.partner_organization_id=v_org AND l.accepted_at IS NOT NULL)
  ORDER BY l.created_at DESC LIMIT 200;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_list_business_links() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_list_business_links() TO authenticated;

CREATE OR REPLACE FUNCTION public.tercis_revoke_business_link(p_link_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_org uuid;v_actor uuid:=auth.uid();v_owner uuid;
BEGIN
  SELECT organization_id INTO v_org FROM public.profiles
  WHERE id=v_actor AND active IS TRUE AND role IN ('admin','company_admin');
  IF v_org IS NULL OR NOT public.tercis_verified_aal2() THEN
    RAISE EXCEPTION 'A revogação exige administração e MFA verificado.'
      USING ERRCODE='42501';
  END IF;
  UPDATE public.tercis_business_links l
    SET revoked_at=now()
    WHERE l.id=p_link_id AND l.revoked_at IS NULL
      AND (l.owning_organization_id=v_org
        OR (l.partner_organization_id=v_org AND l.accepted_at IS NOT NULL))
    RETURNING l.owning_organization_id INTO v_owner;
  IF v_owner IS NULL THEN RETURN FALSE; END IF;
  INSERT INTO public.audit_logs(organization_id,actor_id,entity_type,entity_id,action)
    VALUES(v_org,v_actor,'business_link',p_link_id,'link_revoked');
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_revoke_business_link(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_revoke_business_link(uuid) TO authenticated;
