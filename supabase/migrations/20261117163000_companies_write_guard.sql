/*
  Align legacy companies table writes with actual UI capabilities.

  The original schema permitted every collaborator to create and modify any
  customer company, despite the application not granting manage_clients to that
  role. Until tenant ownership is modeled properly, only approved legacy
  administrators may write this shared customer table.
*/
DROP POLICY IF EXISTS "Tercis client write guard insert" ON public.companies;
CREATE POLICY "Tercis client write guard insert"
  ON public.companies AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.tercis_is_active_legacy_admin());

DROP POLICY IF EXISTS "Tercis client write guard update" ON public.companies;
CREATE POLICY "Tercis client write guard update"
  ON public.companies AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.tercis_is_active_legacy_admin())
  WITH CHECK (public.tercis_is_active_legacy_admin());

DROP POLICY IF EXISTS "Tercis client write guard delete" ON public.companies;
CREATE POLICY "Tercis client write guard delete"
  ON public.companies AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.tercis_is_active_legacy_admin());
