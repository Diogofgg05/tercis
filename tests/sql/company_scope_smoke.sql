-- Verify company_admin cannot access other companies' admin settings/logs.
INSERT INTO auth.users (id,email,raw_user_meta_data)
VALUES ('00000000-0000-4000-8000-000000000005','scoped@example.test','{}');
UPDATE public.profiles SET role='company_admin',active=true,
  organization_id='00000000-0000-4000-8000-000000000900',
  company_id='00000000-0000-4000-8000-000000000100'
WHERE id='00000000-0000-4000-8000-000000000005';

INSERT INTO public.companies(id,name,created_by)
VALUES('00000000-0000-4000-8000-000000000101','Other Client',
       '00000000-0000-4000-8000-000000000001');

INSERT INTO public.company_settings(company_id) VALUES
  ('00000000-0000-4000-8000-000000000100'),
  ('00000000-0000-4000-8000-000000000101');
INSERT INTO public.customer_types(company_id,name) VALUES
  ('00000000-0000-4000-8000-000000000100','Type A'),
  ('00000000-0000-4000-8000-000000000101','Type B');
INSERT INTO public.audit_logs(company_id,actor_id,entity_type,action) VALUES
  ('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000001','budget','read'),
  ('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000001','budget','read'),
  (NULL,'00000000-0000-4000-8000-000000000001','platform','login');

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000005';
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.company_settings;
  IF n <> 1 THEN RAISE EXCEPTION 'OTHER COMPANY SETTINGS VISIBLE: %',n; END IF;
  SELECT count(*) INTO n FROM public.customer_types;
  IF n <> 1 THEN RAISE EXCEPTION 'OTHER COMPANY CUSTOMER TYPES VISIBLE: %',n; END IF;
  SELECT count(*) INTO n FROM public.audit_logs;
  IF n <> 1 THEN RAISE EXCEPTION 'OTHER COMPANY AUDIT LOGS VISIBLE: %',n; END IF;
  UPDATE public.company_settings SET default_tax_rate=19
  WHERE company_id='00000000-0000-4000-8000-000000000101';
  IF FOUND THEN RAISE EXCEPTION 'CROSS-COMPANY SETTINGS UPDATE SUCCEEDED'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.company_settings;
  IF n <> 2 THEN RAISE EXCEPTION 'LEGACY ADMIN SETTINGS ACCESS REGRESSION'; END IF;
  SELECT count(*) INTO n FROM public.audit_logs;
  IF n <> 3 THEN RAISE EXCEPTION 'LEGACY ADMIN AUDIT ACCESS REGRESSION'; END IF;
END $$;
ROLLBACK;

SELECT 'Company scope tests PASSED' AS result;
