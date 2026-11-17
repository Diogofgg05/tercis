-- Minimal Supabase-auth stand-in for PostgreSQL integration tests only.
-- This never runs against an actual Supabase instance.
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  email_confirmed_at timestamptz DEFAULT now(),
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
-- Supabase Auth exposes the JWT assurance level. The fixture defaults to
-- authenticated AAL2; individual MFA regressions explicitly force AAL1.
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims',true),'')::jsonb,
    '{"aal":"aal2"}'::jsonb
  );
$;
GRANT EXECUTE ON FUNCTION auth.jwt() TO authenticated;
