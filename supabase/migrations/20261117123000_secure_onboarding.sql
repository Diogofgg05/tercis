/*
  Secure onboarding hardening — TEST ON A STAGING SUPABASE FIRST.
  Existing users retain their current role/active state; new direct signups
  become inactive clients until an approved provisioning workflow activates them.
  The original migration promoted the FIRST signup to admin: never do that.
  This is NOT a complete multi-tenant security redesign. Legacy admins still
  require a future organisation/tenant ownership model and full RLS audit.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1)),
    'client',
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Avoid recursive RLS checks on profiles; the helper only returns a boolean
-- about the signed-in user and never returns private profile information.
CREATE OR REPLACE FUNCTION public.tercis_is_active()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.active IS TRUE
  );
$$;
REVOKE ALL ON FUNCTION public.tercis_is_active() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tercis_is_active() TO authenticated;

-- Use narrowly scoped SECURITY DEFINER helpers to prevent self-recursive RLS
-- on profiles. The helper returns ONLY permission to read the target, never
-- email, role or other private attributes of a different user.
CREATE OR REPLACE FUNCTION public.tercis_can_read_profile(
  target_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    target_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles AS viewer
      WHERE viewer.id = (SELECT auth.uid())
        AND viewer.active IS TRUE
        AND viewer.role IN ('admin', 'app_admin')
    );
$$;
REVOKE ALL ON FUNCTION public.tercis_can_read_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tercis_can_read_profile(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.tercis_is_active_legacy_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $
  SELECT EXISTS(
    SELECT 1 FROM public.profiles AS viewer
    WHERE viewer.id = (SELECT auth.uid())
      AND viewer.active IS TRUE
      AND viewer.role IN ('admin', 'app_admin')
  );
$;
REVOKE ALL ON FUNCTION public.tercis_is_active_legacy_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tercis_is_active_legacy_admin() TO authenticated;

-- Remove the first-signup bootstrap exception in the old insert policy;
-- otherwise the first unprovisioned user could set their own role on INSERT
-- if a profile row were missing.
DROP POLICY IF EXISTS "Admin can insert profiles" ON public.profiles;
CREATE POLICY "Active legacy admins insert profiles"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.tercis_is_active_legacy_admin());

DROP POLICY IF EXISTS "Admin can delete profiles" ON public.profiles;
CREATE POLICY "Active legacy admins delete profiles"
  ON public.profiles FOR DELETE TO authenticated
  USING (public.tercis_is_active_legacy_admin());

DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profile read is self or active legacy administrator" ON public.profiles;
CREATE POLICY "Profile read is self or active legacy administrator"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.tercis_can_read_profile(id));

-- Do not allow inactive signups to modify any records, including their
-- own profile, until approved by a trusted administrator workflow.
DROP POLICY IF EXISTS "Tercis active profile writes" ON public.profiles;
CREATE POLICY "Tercis active profile writes"
  ON public.profiles AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.tercis_is_active())
  WITH CHECK (public.tercis_is_active());

-- An inactive signup must not read/write commercial data even if the old
-- permissive policies would otherwise allow it. Self-profile read stays open
-- so the frontend can display the pending approval state.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'companies','budgets','budget_items','custom_catalog_items',
    'company_settings','customer_types','budget_versions',
    'budget_timeline_events','budget_attachments','budget_messages','audit_logs'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Tercis active accounts only" ON public.%I', table_name);
    EXECUTE format(
      'CREATE POLICY "Tercis active accounts only" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.tercis_is_active()) WITH CHECK (public.tercis_is_active())',
      table_name
    );
  END LOOP;
END;
$$;
