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

-- Existing role-based SELECT policies were permissive and allowed ALL
-- signed-in users to inspect every user's email and profile data.
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
CREATE POLICY "Profile read is self or active legacy administrator"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (
      public.tercis_is_active() AND EXISTS (
        SELECT 1 FROM public.profiles AS requestor
        WHERE requestor.id = (SELECT auth.uid())
          AND requestor.role IN ('admin', 'app_admin')
      )
    )
  );

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
    EXECUTE format(
      'CREATE POLICY "Tercis active accounts only" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.tercis_is_active()) WITH CHECK (public.tercis_is_active())',
      table_name
    );
  END LOOP;
END;
$$;
