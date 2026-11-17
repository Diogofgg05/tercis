/*
  Prevent company_admin accounts from reading or writing settings, customer
  types and audit logs belonging to a different company. Legacy app_admin/admin
  remain global (existing product behaviour). Internal collaborator reads are
  scoped to their own company, subject to existing permissive policies.

  NOTE: company_id currently conflates customer and organisation membership.
  This is a defensive policy improvement, NOT a complete SaaS tenant model.
*/
CREATE OR REPLACE FUNCTION public.tercis_can_access_company_scope(
  p_company_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles viewer
    WHERE viewer.id = (SELECT auth.uid())
      AND viewer.active IS TRUE
      AND (
        viewer.role IN ('admin','app_admin')
        OR (
          viewer.role IN ('company_admin','collaborator')
          AND viewer.company_id IS NOT NULL
          AND viewer.company_id = p_company_id
        )
      )
  );
$$;
REVOKE ALL ON FUNCTION public.tercis_can_access_company_scope(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tercis_can_access_company_scope(uuid) TO authenticated;

DROP POLICY IF EXISTS "Tercis company scope guard" ON public.company_settings;
CREATE POLICY "Tercis company scope guard"
  ON public.company_settings AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.tercis_can_access_company_scope(company_id))
  WITH CHECK (public.tercis_can_access_company_scope(company_id));

DROP POLICY IF EXISTS "Tercis company scope guard" ON public.customer_types;
CREATE POLICY "Tercis company scope guard"
  ON public.customer_types AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.tercis_can_access_company_scope(company_id))
  WITH CHECK (public.tercis_can_access_company_scope(company_id));

DROP POLICY IF EXISTS "Tercis company scope guard" ON public.audit_logs;
CREATE POLICY "Tercis company scope guard"
  ON public.audit_logs AS RESTRICTIVE FOR ALL TO authenticated
  USING (company_id IS NOT NULL AND public.tercis_can_access_company_scope(company_id))
  WITH CHECK (company_id IS NOT NULL AND public.tercis_can_access_company_scope(company_id));
