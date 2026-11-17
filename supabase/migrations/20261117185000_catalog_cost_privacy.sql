/*
  Prevent customers and platform-only users from downloading shared wholesale
  catalog costs through direct PostgREST requests.

  The legacy policy "All authenticated can read active custom items" exposed
  unit_cost to authenticated customer accounts even when the Catalog page was
  hidden by React. Until explicit tenant ownership exists, restrict this shared
  table to active internal commercial staff.
*/
CREATE OR REPLACE FUNCTION public.tercis_can_read_internal_catalog()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id=(SELECT auth.uid()) AND p.active IS TRUE
      AND (
        p.role IN ('admin','company_admin')
        OR (p.role='collaborator' AND p.collaborator_type='internal')
      )
  );
$$;
REVOKE ALL ON FUNCTION public.tercis_can_read_internal_catalog()
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_can_read_internal_catalog()
  TO authenticated;

DROP POLICY IF EXISTS "Tercis internal catalog costs only"
  ON public.custom_catalog_items;
CREATE POLICY "Tercis internal catalog costs only"
  ON public.custom_catalog_items AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.tercis_can_read_internal_catalog());
