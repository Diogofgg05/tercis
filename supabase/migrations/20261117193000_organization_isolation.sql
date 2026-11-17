
/*
  Tercis — explicit owning organizations (tenants), separate from customers.

  Scope: organization-level RLS for company directory, budgets, profiles,
  catalog, settings, types, audit and budget children. Existing records are
  deliberately assigned to ONE legacy organization. This does not magically
  divide existing shared customer data into separate real businesses.

  Onboarding new organizations and inviting users must be carried out by a
  trusted service role until there is a reviewed invitation/claim workflow.
  Never allow a JWT user to choose or change organization_id.
*/

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.organizations FROM anon;
GRANT SELECT ON public.organizations TO authenticated;

INSERT INTO public.organizations(id,slug,name)
VALUES ('00000000-0000-4000-8000-000000000900','tercis-legacy','Tercis — dados legados')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.custom_catalog_items
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- This conservative backfill keeps all historical shared data together.
-- An operator must classify and migrate legacy data before deploying a second
-- real tenant; do not infer ownership from customer companies.
UPDATE public.profiles
  SET organization_id='00000000-0000-4000-8000-000000000900'
  WHERE organization_id IS NULL AND role <> 'app_admin';
UPDATE public.companies
  SET organization_id='00000000-0000-4000-8000-000000000900'
  WHERE organization_id IS NULL;
UPDATE public.budgets
  SET organization_id='00000000-0000-4000-8000-000000000900'
  WHERE organization_id IS NULL;
UPDATE public.custom_catalog_items
  SET organization_id='00000000-0000-4000-8000-000000000900'
  WHERE organization_id IS NULL;
UPDATE public.audit_logs
  SET organization_id='00000000-0000-4000-8000-000000000900'
  WHERE organization_id IS NULL;

-- Historical platform-only administrators must not be tenant members.
UPDATE public.profiles SET organization_id=NULL WHERE role='app_admin';

-- Avoid changing legacy fixture INSERT syntax: signed-in actors receive their
-- own organization in BEFORE INSERT triggers below; trusted migrations must
-- pass explicit organization_id for new organizations.
ALTER TABLE public.companies ALTER COLUMN organization_id SET DEFAULT '00000000-0000-4000-8000-000000000900'::uuid;
ALTER TABLE public.budgets ALTER COLUMN organization_id SET DEFAULT '00000000-0000-4000-8000-000000000900'::uuid;
ALTER TABLE public.custom_catalog_items ALTER COLUMN organization_id SET DEFAULT '00000000-0000-4000-8000-000000000900'::uuid;
ALTER TABLE public.audit_logs ALTER COLUMN organization_id SET DEFAULT '00000000-0000-4000-8000-000000000900'::uuid;
ALTER TABLE public.companies ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.budgets ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.custom_catalog_items ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.audit_logs ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS tercis_profiles_org_idx ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS tercis_companies_org_idx ON public.companies(organization_id);
CREATE INDEX IF NOT EXISTS tercis_budgets_org_created_idx ON public.budgets(organization_id,created_at DESC);
CREATE INDEX IF NOT EXISTS tercis_catalog_org_idx ON public.custom_catalog_items(organization_id,active);
CREATE INDEX IF NOT EXISTS tercis_audit_org_idx ON public.audit_logs(organization_id,created_at DESC);

CREATE OR REPLACE FUNCTION public.tercis_current_organization_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=public,pg_temp AS $$
  SELECT p.organization_id
  FROM public.profiles p
  WHERE p.id=(SELECT auth.uid()) AND p.active IS TRUE
    AND p.role <> 'app_admin' LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.tercis_current_organization_id() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_current_organization_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.tercis_is_org_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=public,pg_temp AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.profiles p
    WHERE p.id=(SELECT auth.uid()) AND p.active IS TRUE
      AND p.organization_id IS NOT NULL
      AND p.role IN ('admin','company_admin')
  );
$$;
REVOKE ALL ON FUNCTION public.tercis_is_org_admin() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_is_org_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.tercis_company_in_current_org(p_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=public,pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id=p_company_id
      AND c.organization_id=public.tercis_current_organization_id()
  );
$$;
REVOKE ALL ON FUNCTION public.tercis_company_in_current_org(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_company_in_current_org(uuid) TO authenticated;

DROP POLICY IF EXISTS "Tercis read own organization" ON public.organizations;
CREATE POLICY "Tercis read own organization" ON public.organizations
  FOR SELECT TO authenticated USING (
    id=public.tercis_current_organization_id()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id=auth.uid() AND p.role='app_admin' AND p.active IS TRUE
    )
  );

-- Private profiles: admins can inspect ONLY users in their organization.
-- Inactive signups with no invitation stay unassigned and visible only to self.
CREATE OR REPLACE FUNCTION public.tercis_can_read_profile(target_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=public,pg_temp AS $$
  SELECT target_id=(SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles viewer
      JOIN public.profiles target ON target.id=target_id
      WHERE viewer.id=(SELECT auth.uid())
        AND viewer.active IS TRUE
        AND viewer.role IN ('admin','company_admin')
        AND viewer.organization_id IS NOT NULL
        AND viewer.organization_id=target.organization_id
    );
$$;
REVOKE ALL ON FUNCTION public.tercis_can_read_profile(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_can_read_profile(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.tercis_is_active_legacy_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=public,pg_temp AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.profiles p
    WHERE p.id=(SELECT auth.uid()) AND p.active IS TRUE
      AND p.organization_id IS NOT NULL AND p.role='admin'
  );
$$;
REVOKE ALL ON FUNCTION public.tercis_is_active_legacy_admin() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_is_active_legacy_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.tercis_is_internal_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=public,pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id=(SELECT auth.uid()) AND p.active IS TRUE
      AND p.organization_id IS NOT NULL
      AND (p.role IN ('admin','company_admin')
        OR (p.role='collaborator' AND p.collaborator_type='internal'))
  );
$$;
REVOKE ALL ON FUNCTION public.tercis_is_internal_staff() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_is_internal_staff() TO authenticated;

-- Cross-organization foreign keys MUST be checked server-side even when
-- PostgreSQL RLS would permit an indirect reference via a UUID.
CREATE OR REPLACE FUNCTION public.tercis_guard_profile_organization()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_actor_org uuid;
BEGIN
  IF TG_OP='UPDATE' AND auth.uid() IS NOT NULL
    AND NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'A organização do perfil só pode ser atribuída por um processo de convite confiável.'
      USING ERRCODE='42501';
  END IF;
  IF NEW.role='app_admin' AND NEW.organization_id IS NOT NULL THEN
    RAISE EXCEPTION 'A administração da plataforma não pode pertencer a um tenant comercial.'
      USING ERRCODE='42501';
  END IF;
  IF NEW.company_id IS NOT NULL AND (
    NEW.organization_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id=NEW.company_id AND c.organization_id=NEW.organization_id
    )
  ) THEN
    RAISE EXCEPTION 'O cliente associado ao perfil não pertence à sua organização.'
      USING ERRCODE='42501';
  END IF;
  IF NEW.customer_type_id IS NOT NULL AND (
    NEW.organization_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.customer_types t JOIN public.companies c ON c.id=t.company_id
      WHERE t.id=NEW.customer_type_id AND c.organization_id=NEW.organization_id
    )
  ) THEN
    RAISE EXCEPTION 'Tipo de cliente fora da organização.' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tercis_guard_profile_organization_write ON public.profiles;
CREATE TRIGGER tercis_guard_profile_organization_write
  BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW
  EXECUTE FUNCTION public.tercis_guard_profile_organization();

CREATE OR REPLACE FUNCTION public.tercis_guard_company_organization()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_org uuid := public.tercis_current_organization_id();
BEGIN
  IF TG_OP='INSERT' AND v_org IS NOT NULL THEN
    IF NEW.organization_id IS NULL OR
       NEW.organization_id='00000000-0000-4000-8000-000000000900'::uuid THEN
      NEW.organization_id:=v_org;
    ELSIF NEW.organization_id<>v_org THEN
      RAISE EXCEPTION 'Não pode criar um cliente noutra organização.' USING ERRCODE='42501';
    END IF;
  ELSIF TG_OP='UPDATE' AND NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'A organização de um cliente não pode ser alterada.' USING ERRCODE='42501';
  END IF;
  IF v_org IS NOT NULL AND NEW.organization_id IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'Cliente fora da organização autenticada.' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tercis_guard_company_organization_write ON public.companies;
CREATE TRIGGER tercis_guard_company_organization_write
  BEFORE INSERT OR UPDATE ON public.companies FOR EACH ROW
  EXECUTE FUNCTION public.tercis_guard_company_organization();

CREATE OR REPLACE FUNCTION public.tercis_guard_budget_organization()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_org uuid := public.tercis_current_organization_id();
BEGIN
  IF TG_OP='INSERT' AND v_org IS NOT NULL THEN
    IF NEW.organization_id IS NULL OR
       NEW.organization_id='00000000-0000-4000-8000-000000000900'::uuid THEN
      NEW.organization_id:=v_org;
    ELSIF NEW.organization_id<>v_org THEN
      RAISE EXCEPTION 'Não pode criar orçamentos noutra organização.' USING ERRCODE='42501';
    END IF;
  ELSIF TG_OP='UPDATE' AND NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'Um orçamento não pode mudar de organização.' USING ERRCODE='42501';
  END IF;
  IF v_org IS NOT NULL AND NEW.organization_id IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'Orçamento fora da sua organização.' USING ERRCODE='42501';
  END IF;
  IF NEW.company_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id=NEW.company_id AND c.organization_id=NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'O cliente do orçamento pertence a outra organização.' USING ERRCODE='42501';
  END IF;
  IF NEW.created_by IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id=NEW.created_by AND p.organization_id=NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'Criador do orçamento fora da organização.' USING ERRCODE='42501';
  END IF;
  IF NEW.assigned_to IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id=NEW.assigned_to AND p.organization_id=NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'Colaborador atribuído fora da organização.' USING ERRCODE='42501';
  END IF;
  IF NEW.client_profile_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id=NEW.client_profile_id AND p.organization_id=NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'Contacto associado fora da organização.' USING ERRCODE='42501';
  END IF;
  IF NEW.customer_type_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.customer_types t JOIN public.companies c ON c.id=t.company_id
    WHERE t.id=NEW.customer_type_id AND c.organization_id=NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'Tipo de cliente do orçamento fora da organização.' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tercis_guard_budget_organization_write ON public.budgets;
CREATE TRIGGER tercis_guard_budget_organization_write
  BEFORE INSERT OR UPDATE ON public.budgets FOR EACH ROW
  EXECUTE FUNCTION public.tercis_guard_budget_organization();

CREATE OR REPLACE FUNCTION public.tercis_guard_catalog_organization()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_org uuid := public.tercis_current_organization_id();
BEGIN
  IF TG_OP='INSERT' AND v_org IS NOT NULL THEN
    IF NEW.organization_id IS NULL OR
       NEW.organization_id='00000000-0000-4000-8000-000000000900'::uuid THEN
      NEW.organization_id:=v_org;
    ELSIF NEW.organization_id<>v_org THEN
      RAISE EXCEPTION 'Catálogo de outra organização.' USING ERRCODE='42501';
    END IF;
  ELSIF TG_OP='UPDATE' AND NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'Não pode transferir o catálogo entre organizações.' USING ERRCODE='42501';
  END IF;
  IF v_org IS NOT NULL AND NEW.organization_id IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'Catálogo de outra organização.' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tercis_guard_catalog_organization_write ON public.custom_catalog_items;
CREATE TRIGGER tercis_guard_catalog_organization_write
  BEFORE INSERT OR UPDATE ON public.custom_catalog_items FOR EACH ROW
  EXECUTE FUNCTION public.tercis_guard_catalog_organization();

CREATE OR REPLACE FUNCTION public.tercis_guard_audit_organization()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_org uuid := public.tercis_current_organization_id();
BEGIN
  IF TG_OP='INSERT' AND v_org IS NOT NULL THEN
    IF NEW.organization_id IS NULL OR
       NEW.organization_id='00000000-0000-4000-8000-000000000900'::uuid THEN
      NEW.organization_id:=v_org;
    ELSIF NEW.organization_id<>v_org THEN
      RAISE EXCEPTION 'Auditoria de outra organização.' USING ERRCODE='42501';
    END IF;
  ELSIF TG_OP='UPDATE' AND NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'Não pode transferir auditoria entre organizações.' USING ERRCODE='42501';
  END IF;
  IF v_org IS NOT NULL AND NEW.organization_id IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'Auditoria de outra organização.' USING ERRCODE='42501';
  END IF;
  IF NEW.company_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id=NEW.company_id AND c.organization_id=NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'Auditoria com cliente de outra organização.' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tercis_guard_audit_organization_write ON public.audit_logs;
CREATE TRIGGER tercis_guard_audit_organization_write
  BEFORE INSERT OR UPDATE ON public.audit_logs FOR EACH ROW
  EXECUTE FUNCTION public.tercis_guard_audit_organization();

-- A RESTRICTIVE SELECT/UPDATE/INSERT/DELETE policy ANDs with every old
-- permissive policy; old broad "admin sees all" is no longer global.
DROP POLICY IF EXISTS "Tercis organization boundary" ON public.companies;
CREATE POLICY "Tercis organization boundary" ON public.companies
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (organization_id=public.tercis_current_organization_id())
  WITH CHECK (organization_id=public.tercis_current_organization_id());
DROP POLICY IF EXISTS "Tercis organization boundary" ON public.budgets;
CREATE POLICY "Tercis organization boundary" ON public.budgets
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (organization_id=public.tercis_current_organization_id())
  WITH CHECK (organization_id=public.tercis_current_organization_id());
DROP POLICY IF EXISTS "Tercis organization boundary" ON public.custom_catalog_items;
CREATE POLICY "Tercis organization boundary" ON public.custom_catalog_items
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (organization_id=public.tercis_current_organization_id())
  WITH CHECK (organization_id=public.tercis_current_organization_id());
DROP POLICY IF EXISTS "Tercis organization boundary" ON public.audit_logs;
CREATE POLICY "Tercis organization boundary" ON public.audit_logs
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (organization_id=public.tercis_current_organization_id())
  WITH CHECK (organization_id=public.tercis_current_organization_id());

-- A platform-only app_admin must not see raw commercial data, even if an
-- older helper or a broad permissive policy still names that role.
CREATE OR REPLACE FUNCTION public.tercis_can_read_customer_company(p_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=public,pg_temp AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.companies c
    JOIN public.profiles p ON p.id=(SELECT auth.uid())
    WHERE c.id=p_company_id AND p.active IS TRUE
      AND p.organization_id IS NOT NULL
      AND p.organization_id=c.organization_id
      AND (
        p.role IN ('admin','company_admin')
        OR (p.role='client' AND p.company_id=p_company_id)
        OR (p.role='collaborator' AND p.collaborator_type='client' AND p.company_id=p_company_id)
        OR (p.role='collaborator' AND p.collaborator_type='internal' AND (
          p.company_id=p_company_id
          OR EXISTS (
            SELECT 1 FROM public.budgets b
            WHERE b.company_id=p_company_id AND b.organization_id=p.organization_id
              AND (b.created_by=p.id OR b.assigned_to=p.id)
          )
        ))
      )
  );
$$;
REVOKE ALL ON FUNCTION public.tercis_can_read_customer_company(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_can_read_customer_company(uuid) TO authenticated;

DROP POLICY IF EXISTS "Tercis company admins read own organization customers" ON public.companies;
CREATE POLICY "Tercis company admins read own organization customers" ON public.companies
  FOR SELECT TO authenticated
  USING (public.tercis_is_org_admin());

-- Preserve restrictive legacy per-customer settings rules, but ALSO require
-- the referenced customer itself to belong to the viewer's organization.
DROP POLICY IF EXISTS "Tercis settings owning organization" ON public.company_settings;
CREATE POLICY "Tercis settings owning organization" ON public.company_settings
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.tercis_company_in_current_org(company_id))
  WITH CHECK (public.tercis_company_in_current_org(company_id));
DROP POLICY IF EXISTS "Tercis customer types owning organization" ON public.customer_types;
CREATE POLICY "Tercis customer types owning organization" ON public.customer_types
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.tercis_company_in_current_org(company_id))
  WITH CHECK (public.tercis_company_in_current_org(company_id));

-- The existing RLS on budget items is mediated by budget SELECT, which is now
-- tenant-scoped. Add explicit budget-parent safeguards for all child tables.
CREATE OR REPLACE FUNCTION public.tercis_budget_in_current_org(p_budget_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=public,pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id=p_budget_id
      AND b.organization_id=public.tercis_current_organization_id()
  );
$$;
REVOKE ALL ON FUNCTION public.tercis_budget_in_current_org(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_budget_in_current_org(uuid) TO authenticated;

-- These policies don't grant access on their own. Existing permissive RLS
-- and client visibility guards still decide which operations are allowed.
DROP POLICY IF EXISTS "Tercis tenant parent" ON public.budget_items;
CREATE POLICY "Tercis tenant parent" ON public.budget_items
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.tercis_budget_in_current_org(budget_id))
  WITH CHECK (public.tercis_budget_in_current_org(budget_id));
DROP POLICY IF EXISTS "Tercis tenant parent" ON public.budget_versions;
CREATE POLICY "Tercis tenant parent" ON public.budget_versions
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.tercis_budget_in_current_org(budget_id))
  WITH CHECK (public.tercis_budget_in_current_org(budget_id));
DROP POLICY IF EXISTS "Tercis tenant parent" ON public.budget_timeline_events;
CREATE POLICY "Tercis tenant parent" ON public.budget_timeline_events
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.tercis_budget_in_current_org(budget_id))
  WITH CHECK (public.tercis_budget_in_current_org(budget_id));
DROP POLICY IF EXISTS "Tercis tenant parent" ON public.budget_attachments;
CREATE POLICY "Tercis tenant parent" ON public.budget_attachments
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.tercis_budget_in_current_org(budget_id))
  WITH CHECK (public.tercis_budget_in_current_org(budget_id));
DROP POLICY IF EXISTS "Tercis tenant parent" ON public.budget_messages;
CREATE POLICY "Tercis tenant parent" ON public.budget_messages
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.tercis_budget_in_current_org(budget_id))
  WITH CHECK (public.tercis_budget_in_current_org(budget_id));

-- An organization manager may inspect and work on its own budgets. Separate
-- restrictive checks still enforce editable status, workflow and tenant.
DROP POLICY IF EXISTS "Tercis org administrators read budgets" ON public.budgets;
CREATE POLICY "Tercis org administrators read budgets" ON public.budgets
  FOR SELECT TO authenticated USING (public.tercis_is_org_admin());
DROP POLICY IF EXISTS "Tercis org administrators create budgets" ON public.budgets;
CREATE POLICY "Tercis org administrators create budgets" ON public.budgets
  FOR INSERT TO authenticated WITH CHECK (
    public.tercis_is_org_admin() AND created_by=(SELECT auth.uid())
  );
DROP POLICY IF EXISTS "Tercis org administrators edit budgets" ON public.budgets;
CREATE POLICY "Tercis org administrators edit budgets" ON public.budgets
  FOR UPDATE TO authenticated USING (public.tercis_is_org_admin())
  WITH CHECK (public.tercis_is_org_admin());
DROP POLICY IF EXISTS "Tercis org administrators delete own drafts" ON public.budgets;
CREATE POLICY "Tercis org administrators delete own drafts" ON public.budgets
  FOR DELETE TO authenticated USING (
    public.tercis_is_org_admin() AND created_by=(SELECT auth.uid())
  );

-- The old creation guard excluded company_admin even when the new permissive
-- policy permits that role; replace it with tenant-safe validation.
DROP POLICY IF EXISTS "Tercis quote creation company guard" ON public.budgets;
CREATE POLICY "Tercis quote creation company guard" ON public.budgets
  AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
    created_by=(SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id=(SELECT auth.uid()) AND p.active IS TRUE
        AND p.organization_id=budgets.organization_id
        AND (
          p.role IN ('admin','company_admin')
          OR (p.role='collaborator' AND p.collaborator_type='internal'
              AND budgets.company_id IS NULL
              AND (budgets.assigned_to IS NULL OR budgets.assigned_to=p.id))
        )
    )
  );

-- Company_admin is a tenant commercial user, NOT a platform administrator.
-- Fine-grained management remains constrained by the original edit-phase
-- and ownership rules; sensitive provisioning uses its own RPC.


-- A SECURITY DEFINER function ignores table RLS. Check ownership explicitly
-- before any workflow transition, including legacy administrators.
CREATE OR REPLACE FUNCTION public.tercis_transition_budget(
  p_budget_id uuid,p_to text,p_expected_version integer
) RETURNS TABLE (id uuid, version integer, status text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text;
  v_kind text;
  v_company uuid;
  v_organization uuid;
  v_budget public.budgets%ROWTYPE;
  v_new_version integer;
BEGIN
  SELECT role,collaborator_type,company_id,organization_id INTO v_role,v_kind,v_company,v_organization
  FROM public.profiles AS p WHERE p.id=v_actor AND p.active IS TRUE;
  IF v_role IS NULL OR v_organization IS NULL THEN
    RAISE EXCEPTION 'Conta sem organização comercial autorizada.' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_budget FROM public.budgets b
  WHERE b.id=p_budget_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado.' USING ERRCODE='22023';
  END IF;
  IF v_budget.organization_id IS DISTINCT FROM v_organization THEN
    RAISE EXCEPTION 'Não pode alterar um orçamento de outra organização.' USING ERRCODE='42501';
  END IF;
  IF v_budget.version IS DISTINCT FROM p_expected_version THEN
    RAISE EXCEPTION 'O orçamento foi alterado noutra sessão. Reabra-o antes de alterar o estado.'
      USING ERRCODE='40001';
  END IF;

  IF v_role='client' OR (v_role='collaborator' AND v_kind='client') THEN
    IF v_company IS NULL OR v_company IS DISTINCT FROM v_budget.company_id THEN
      RAISE EXCEPTION 'Sem acesso a este orçamento.' USING ERRCODE='42501';
    END IF;
  ELSIF v_role='collaborator' THEN
    IF v_budget.created_by IS DISTINCT FROM v_actor
       AND v_budget.assigned_to IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'O orçamento não está atribuído à sua conta.' USING ERRCODE='42501';
    END IF;
  ELSIF v_role='company_admin' THEN
    -- Organization, rather than customer, is the authority boundary.
    NULL;
  ELSIF v_role <> 'admin' THEN
    RAISE EXCEPTION 'Sem autorização para a transição.' USING ERRCODE='42501';
  END IF;

  IF NOT public.tercis_budget_can_move(v_budget.status,p_to,v_actor) THEN
    RAISE EXCEPTION 'Transição de estado não permitida.' USING ERRCODE='42501';
  END IF;

  UPDATE public.budgets b SET
    status=p_to,
    version=b.version+1,
    submitted_at=CASE WHEN p_to='pendente_aprovacao' THEN now() ELSE b.submitted_at END,
    approved_at=CASE WHEN p_to='aprovado' THEN now() ELSE b.approved_at END,
    sent_at=CASE WHEN p_to='enviado' THEN now() ELSE b.sent_at END,
    accepted_at=CASE WHEN p_to='aceite' THEN now() ELSE b.accepted_at END
  WHERE b.id=p_budget_id
  RETURNING b.version INTO v_new_version;

  -- Audit is now recorded by the AFTER UPDATE trigger for every valid path.
  RETURN QUERY SELECT p_budget_id,v_new_version,p_to;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_transition_budget(uuid,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_transition_budget(uuid,text,integer) TO authenticated;


-- Profile approval can only mutate a user already assigned to the actor's
-- organization. An unassigned signup requires a trusted invitation/provision
-- step first, never a cross-tenant manual lookup.
CREATE OR REPLACE FUNCTION public.tercis_admin_update_user(
  p_user_id uuid,p_role text,p_active boolean,p_company_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor uuid:=auth.uid(); v_org uuid; v_target public.profiles%ROWTYPE;
BEGIN
  SELECT organization_id INTO v_org FROM public.profiles
  WHERE id=v_actor AND role='admin' AND active IS TRUE;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Apenas o administrador da organização pode aprovar contas.'
      USING ERRCODE='42501';
  END IF;
  IF p_user_id=v_actor THEN
    RAISE EXCEPTION 'Não pode alterar o próprio papel.' USING ERRCODE='42501';
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('client','collaborator','company_admin')
    OR p_active IS NULL THEN
    RAISE EXCEPTION 'Dados de acesso inválidos.' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_target FROM public.profiles WHERE id=p_user_id FOR UPDATE;
  IF NOT FOUND OR v_target.organization_id IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'Utilizador inexistente ou fora da organização.'
      USING ERRCODE='42501';
  END IF;
  IF v_target.role IN ('admin','app_admin') THEN
    RAISE EXCEPTION 'Perfil administrativo protegido.' USING ERRCODE='42501';
  END IF;
  IF p_company_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id=p_company_id AND c.organization_id=v_org AND c.active IS TRUE
  ) THEN
    RAISE EXCEPTION 'O cliente escolhido não pertence à sua organização.'
      USING ERRCODE='42501';
  END IF;
  IF p_role IN ('client','company_admin') AND p_active AND p_company_id IS NULL THEN
    RAISE EXCEPTION 'Indique a empresa cliente antes de ativar esta conta.'
      USING ERRCODE='22023';
  END IF;
  UPDATE public.profiles SET role=p_role,active=p_active,company_id=p_company_id
  WHERE id=p_user_id;
  INSERT INTO public.audit_logs (
    organization_id,company_id,actor_id,entity_type,entity_id,action,metadata
  ) VALUES (
    v_org,p_company_id,v_actor,'profile',p_user_id,'team_account_updated',
    jsonb_build_object('role',p_role,'active',p_active)
  );
  RETURN p_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_admin_update_user(uuid,text,boolean,uuid)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_admin_update_user(uuid,text,boolean,uuid)
  TO authenticated;

-- Client feeds are SECURITY DEFINER too. Company id alone is not a tenant id.
CREATE OR REPLACE FUNCTION public.tercis_current_client_company()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT p.company_id FROM public.profiles p
  JOIN public.companies c ON c.id=p.company_id AND c.organization_id=p.organization_id
  WHERE p.id=(SELECT auth.uid()) AND p.active IS TRUE
    AND p.organization_id IS NOT NULL
    AND (p.role='client' OR (p.role='collaborator' AND p.collaborator_type='client'))
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.tercis_current_client_company() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_current_client_company() TO authenticated;

CREATE OR REPLACE FUNCTION public.tercis_client_quote_feed()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
  v_company uuid;
  v_data jsonb;
BEGIN
  v_company:=public.tercis_current_client_company();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Esta operação é exclusiva de clientes ativos associados a uma empresa.'
      USING ERRCODE='42501';
  END IF;
  SELECT coalesce(jsonb_agg(entry ORDER BY sort_time DESC),'[]'::jsonb) INTO v_data
  FROM (
    SELECT b.created_at AS sort_time,
      jsonb_build_object(
        'id',b.id,'ref',b.ref,'name',b.name,'company_id',b.company_id,
        'company',jsonb_build_object('id',c.id,'name',c.name),
        'assigned_to',NULL,'status',b.status,'sector',b.sector,
        'date',b.date,'valid_until',b.valid_until,
        'notes','','client_contact','','client_email','',
        'include_tax',b.include_tax,'tax_rate',b.tax_rate,
        'version',b.version,'created_at',b.created_at,'updated_at',b.updated_at,
        'items',coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'id',i.id,'budget_id',i.budget_id,'code',i.code,
            'description',i.description,'reference',i.reference,
            'unit',i.unit,'quantity',i.quantity,
            -- customer unit price includes margin and item discount; cost and
            -- margin are NEVER returned to the browser
            'unit_price',round(i.unit_cost*(1+i.margin/100)*(1-i.discount/100),4),
            'sort_order',i.sort_order
          ) ORDER BY i.sort_order)
          FROM public.budget_items i WHERE i.budget_id=b.id
        ),'[]'::jsonb)
      ) AS entry
    FROM public.budgets b
    JOIN public.companies c ON c.id=b.company_id
    WHERE b.company_id=v_company AND b.organization_id=public.tercis_current_organization_id()
      AND b.sent_at IS NOT NULL
      AND b.status IN ('enviado','aceite','rejeitado','pedido_alteracoes',
                       'expirado','em_execucao','concluido')
    ORDER BY b.created_at DESC LIMIT 500
  ) data;
  RETURN coalesce(v_data,'[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_client_quote_feed() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_client_quote_feed() TO authenticated;

CREATE OR REPLACE FUNCTION public.tercis_client_message_feed()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE v_company uuid; v_data jsonb;
BEGIN
  v_company:=public.tercis_current_client_company();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Esta operação é exclusiva de clientes ativos.' USING ERRCODE='42501';
  END IF;

  SELECT coalesce(jsonb_agg(entry ORDER BY sort_time DESC),'[]'::jsonb) INTO v_data
  FROM (
    SELECT m.created_at AS sort_time,
      jsonb_build_object('id',m.id,'budget_id',m.budget_id,
        'body',m.body,'visibility',m.visibility,'sender_id',m.sender_id,
        'channel',m.channel,'created_at',m.created_at) AS entry
    FROM public.budget_messages m
    JOIN public.budgets b ON b.id=m.budget_id
    WHERE b.company_id=v_company AND b.organization_id=public.tercis_current_organization_id() AND m.company_id=v_company
      AND m.visibility IN ('client','both')
      AND b.sent_at IS NOT NULL
      AND b.status IN ('enviado','aceite','rejeitado','pedido_alteracoes',
                       'expirado','em_execucao','concluido')
    ORDER BY m.created_at DESC LIMIT 200
  ) data;
  RETURN coalesce(v_data,'[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_client_message_feed() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_client_message_feed() TO authenticated;


-- The current client directory is owned by a tenant. Company admins may
-- maintain it only within that tenant, never across tenants.
DROP POLICY IF EXISTS "Tercis client write guard insert" ON public.companies;
CREATE POLICY "Tercis client write guard insert" ON public.companies
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.tercis_is_org_admin());
DROP POLICY IF EXISTS "Tercis client write guard update" ON public.companies;
CREATE POLICY "Tercis client write guard update" ON public.companies
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.tercis_is_org_admin())
  WITH CHECK (public.tercis_is_org_admin());
DROP POLICY IF EXISTS "Tercis client write guard delete" ON public.companies;
CREATE POLICY "Tercis client write guard delete" ON public.companies
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.tercis_is_org_admin());
DROP POLICY IF EXISTS "Tercis org admins maintain customers" ON public.companies;
CREATE POLICY "Tercis org admins maintain customers" ON public.companies
  FOR ALL TO authenticated USING (public.tercis_is_org_admin())
  WITH CHECK (public.tercis_is_org_admin());

-- Scoped internal catalog: permit administrators of the owning organization
-- while maintaining raw-cost exclusions for client and platform users.
CREATE OR REPLACE FUNCTION public.tercis_can_read_internal_catalog()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
      AND p.active IS TRUE AND p.organization_id IS NOT NULL
      AND (p.role IN ('admin','company_admin') OR
           (p.role='collaborator' AND p.collaborator_type='internal'))
  );
$$;
REVOKE ALL ON FUNCTION public.tercis_can_read_internal_catalog() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_can_read_internal_catalog() TO authenticated;

DROP POLICY IF EXISTS "Tercis org admins maintain catalog" ON public.custom_catalog_items;
CREATE POLICY "Tercis org admins maintain catalog" ON public.custom_catalog_items
  FOR ALL TO authenticated USING (public.tercis_is_org_admin())
  WITH CHECK (public.tercis_is_org_admin());

-- Child events must refer to a budget and customer of the SAME owning tenant,
-- even if a privileged service bypasses RLS.
CREATE OR REPLACE FUNCTION public.tercis_guard_budget_child_company()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.budgets b
    JOIN public.companies c ON c.id=b.company_id
    WHERE b.id=NEW.budget_id AND b.company_id=NEW.company_id
      AND b.organization_id=c.organization_id
  ) THEN
    RAISE EXCEPTION 'O registo associa um orçamento a uma empresa cliente diferente.'
      USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
DO $$
DECLARE v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'budget_timeline_events','budget_attachments','budget_messages'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS tercis_child_company_consistency ON public.%I',v_table
    );
    EXECUTE format(
      'CREATE TRIGGER tercis_child_company_consistency
       BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW
       EXECUTE FUNCTION public.tercis_guard_budget_child_company()',v_table
    );
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_guard_budget_child_company()
  FROM PUBLIC,anon,authenticated;
