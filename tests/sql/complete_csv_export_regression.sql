-- Server-side CSV returns all authorized proposals, not only the loaded
-- browser page, with exact numeric totals and no customer/foreign tenant leak.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claims='{"aal":"aal2"}';
DO $$
DECLARE records jsonb; expected bigint; n bigint; r jsonb;
BEGIN
  records:=public.tercis_export_budget_csv_rows('','',false);
  SELECT count(*) INTO expected FROM public.budgets
    WHERE archived_at IS NULL;
  n:=jsonb_array_length(records);
  IF n IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'CSV HAS ONLY A PARTIAL PAGE: % expected %',n,expected;
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(records) a
    WHERE a->>'ref' IS NULL OR a->>'status' IS NULL
      OR a->>'amount' IS NULL) THEN
    RAISE EXCEPTION 'CSV MISSES REQUIRED QUOTE FIELDS';
  END IF;
  r:=public.tercis_export_budget_csv_rows('NO SUCH CUSTOMER','',false);
  IF jsonb_array_length(r)<>0 THEN
    RAISE EXCEPTION 'CSV QUERY FILTER NOT APPLIED';
  END IF;
  r:=public.tercis_export_budget_csv_rows('','rascunho',false);
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(r) a
    WHERE a->>'status'<>'rascunho') THEN
    RAISE EXCEPTION 'CSV STATUS FILTER NOT APPLIED';
  END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';
DO $$
DECLARE denied boolean:=false;
BEGIN
  BEGIN
    PERFORM public.tercis_export_budget_csv_rows('','',false);
  EXCEPTION WHEN insufficient_privilege OR SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'CUSTOMER EXPORTED INTERNAL QUOTES'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000007';
SET LOCAL request.jwt.claims='{"aal":"aal2"}';
DO $$
DECLARE records jsonb;expected bigint;
BEGIN
  records:=public.tercis_export_budget_csv_rows('','',false);
  SELECT count(*) INTO expected FROM public.budgets
    WHERE archived_at IS NULL;
  IF jsonb_array_length(records) IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'SECOND TENANT EXPORT DID NOT FOLLOW RLS';
  END IF;
END $$;
ROLLBACK;
SELECT 'Full tenant scoped CSV export PASSED' AS result;
