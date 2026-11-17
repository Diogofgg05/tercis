BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claims='{"aal":"aal2"}';
DO $$
DECLARE v_count bigint; v_real bigint;
BEGIN
  SELECT quote_count INTO v_count FROM public.tercis_company_budget_counts()
   WHERE company_id='00000000-0000-4000-8000-000000000100';
  SELECT count(*) INTO v_real FROM public.budgets b
   WHERE b.company_id='00000000-0000-4000-8000-000000000100';
  IF v_count IS DISTINCT FROM v_real THEN
    RAISE EXCEPTION 'CRM COUNT DIFFERS FROM SERVER BUDGETS';
  END IF;
  IF EXISTS(SELECT 1 FROM public.tercis_company_budget_counts()
   WHERE company_id='00000000-0000-4000-8000-000000000102')
  THEN RAISE EXCEPTION 'CRM REVEALED OTHER TENANT COUNTS'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';
DO $$
DECLARE denied boolean:=false;
BEGIN
  BEGIN
    PERFORM public.tercis_company_budget_counts();
  EXCEPTION WHEN SQLSTATE '42501' OR insufficient_privilege THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'CUSTOMER MAY READ STAFF CRM COUNTS'; END IF;
END $$;
ROLLBACK;
SELECT 'Tenant-safe client quote counts PASSED' AS result;
