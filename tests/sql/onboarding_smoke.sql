-- End-to-end SQL checks with real PostgreSQL RLS and role switching.
-- The fixture is disposable and includes NO customer data.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

INSERT INTO auth.users (id,email,raw_user_meta_data) VALUES
  ('00000000-0000-4000-8000-000000000001','admin@example.test','{"full_name":"Demo Admin"}'),
  ('00000000-0000-4000-8000-000000000002','pending@example.test','{"full_name":"Demo Pending"}'),
  ('00000000-0000-4000-8000-000000000003','worker@example.test','{"full_name":"Demo Worker"}');

-- Every new account is client+inactive; no "first registration is admin".
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE active = true OR role <> 'client')
     OR (SELECT count(*) FROM profiles) <> 3
  THEN RAISE EXCEPTION 'NEW SIGNUPS MUST NOT BE AUTOMATIC ADMINS OR ACTIVE'; END IF;
END $$;

-- Simulate manual approvals by the trusted database operator, NOT by a user.
UPDATE profiles SET role='admin', active=true
  WHERE id='00000000-0000-4000-8000-000000000001';
UPDATE profiles SET role='collaborator', active=true
  WHERE id='00000000-0000-4000-8000-000000000003';

INSERT INTO public.companies (id,name,created_by)
VALUES ('00000000-0000-4000-8000-000000000100','Example Client',
        '00000000-0000-4000-8000-000000000001');
INSERT INTO public.budgets (id,ref,name,company_id,created_by)
VALUES ('00000000-0000-4000-8000-000000000200','ORC-TEST-001','Test Quote',
        '00000000-0000-4000-8000-000000000100',
        '00000000-0000-4000-8000-000000000001');

-- Pending accounts can only read their own profile, never company or budget data.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.profiles;
  IF n <> 1 THEN RAISE EXCEPTION 'PENDING PROFILE LEAK: %',n; END IF;
  SELECT count(*) INTO n FROM public.companies;
  IF n <> 0 THEN RAISE EXCEPTION 'PENDING COMPANY LEAK: %',n; END IF;
  SELECT count(*) INTO n FROM public.budgets;
  IF n <> 0 THEN RAISE EXCEPTION 'PENDING BUDGET LEAK: %',n; END IF;
END $$;
ROLLBACK;

-- Approved collaborators may access only their profile and their own budgets.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000003';
DO $$
DECLARE n integer;
DECLARE escalated boolean := false;
BEGIN
  SELECT count(*) INTO n FROM public.profiles;
  IF n <> 1 THEN RAISE EXCEPTION 'COLLABORATOR PROFILE LEAK: %',n; END IF;

  SELECT count(*) INTO n FROM public.budgets;
  IF n <> 0 THEN RAISE EXCEPTION 'COLLABORATOR READS OTHER USER QUOTES: %',n; END IF;

  BEGIN
    UPDATE public.profiles SET role='admin'
    WHERE id='00000000-0000-4000-8000-000000000003';
    escalated := true;
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  IF escalated THEN RAISE EXCEPTION 'ROLE ESCALATION WAS ALLOWED'; END IF;
END $$;
ROLLBACK;

-- Active legacy administrators may inspect all profiles as designed.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.profiles;
  IF n <> 3 THEN RAISE EXCEPTION 'ADMIN CANNOT READ TEAM: %',n; END IF;
  SELECT count(*) INTO n FROM public.budgets;
  IF n <> 1 THEN RAISE EXCEPTION 'ADMIN CANNOT READ BUDGET: %',n; END IF;
END $$;
ROLLBACK;

SELECT 'Tercis PostgreSQL RLS and onboarding smoke tests PASSED' AS result;
