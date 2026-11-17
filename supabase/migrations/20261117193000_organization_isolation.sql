
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
