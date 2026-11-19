-- Minimal Supabase-auth stand-in for PostgreSQL integration tests only.
-- This never runs against an actual Supabase instance.
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
-- Supabase's public schema grants normal table access by default; migrations
-- explicitly revoke it for RPC-only tables. Exercise actual RLS, not missing ACLs.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
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
GRANT USAGE ON SCHEMA public, auth TO service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
    CASE WHEN current_user='service_role' THEN 'service_role'
      WHEN current_user='authenticated' THEN 'authenticated'
      ELSE 'anon' END);
$$;
GRANT EXECUTE ON FUNCTION auth.role() TO authenticated,service_role;
-- Supabase Auth exposes the JWT assurance level. The fixture defaults to
-- authenticated AAL2; individual MFA regressions explicitly force AAL1.
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims',true),'')::jsonb,
    '{"aal":"aal2"}'::jsonb
  );
$$;
GRANT EXECUTE ON FUNCTION auth.jwt() TO authenticated;

-- Minimal Supabase Storage stand-in for tenant RLS regression tests only.
CREATE SCHEMA storage;
-- Isolated Storage API operation simulation: real Supabase provides these
-- helpers, but vanilla PostgreSQL in CI does not.
CREATE FUNCTION storage.operation() RETURNS text LANGUAGE sql STABLE AS $op_mock$
  SELECT nullif(current_setting('storage.operation',true),'');
$op_mock$;
CREATE FUNCTION storage.allow_any_operation(expected text[]) RETURNS boolean
LANGUAGE sql STABLE AS $op_list$
  SELECT EXISTS (
    SELECT 1 FROM unnest(expected) candidate
    WHERE candidate=regexp_replace(storage.operation(),'^storage\\.','')
  );
$op_list$;
GRANT EXECUTE ON FUNCTION storage.operation() TO authenticated;
GRANT EXECUTE ON FUNCTION storage.allow_any_operation(text[]) TO authenticated;
CREATE TABLE storage.buckets(
  id text PRIMARY KEY, name text NOT NULL, public boolean NOT NULL DEFAULT false,
  file_size_limit bigint, allowed_mime_types text[]
);
CREATE TABLE storage.objects(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text NOT NULL REFERENCES storage.buckets(id),
  name text NOT NULL UNIQUE,
  owner_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO authenticated,anon;
GRANT SELECT ON storage.buckets TO authenticated,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;
