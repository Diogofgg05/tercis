-- Dashboard values must come from all visible rows and never from other
-- organizations. Customer accounts cannot query internal sales estimates.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claims='{"aal":"aal2"}';
DO $$
DECLARE k jsonb; n integer; expected integer;
BEGIN
  SELECT public.tercis_dashboard_kpis() INTO k;
  SELECT count(*) INTO expected FROM public.budgets b WHERE b.archived_at IS NULL;
  IF k IS NULL OR (k->>'quote_count')::integer IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'DASHBOARD DID NOT AGGREGATE ALL VISIBLE QUOTES';
  END IF;
  IF (k->>'quote_volume')::numeric<0 OR
     (k->>'pending_count')::integer>expected THEN
    RAISE EXCEPTION 'DASHBOARD VALUE INVALID';
  END IF;
  SELECT count(*) INTO n FROM public.budgets
    WHERE id='00000000-0000-4000-8000-000000000280';
  IF n<>0 THEN RAISE EXCEPTION 'ADMIN A CAN SEE TENANT B'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';
DO $$
DECLARE denied boolean:=false;
BEGIN
  BEGIN
    PERFORM public.tercis_dashboard_kpis();
  EXCEPTION WHEN insufficient_privilege OR SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'CUSTOMER CAN READ STAFF DASHBOARD KPI'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000007';
SET LOCAL request.jwt.claims='{"aal":"aal2"}';
DO $$
DECLARE k jsonb; own integer;
BEGIN
  SELECT public.tercis_dashboard_kpis() INTO k;
  SELECT count(*) INTO own FROM public.budgets b WHERE b.archived_at IS NULL;
  IF (k->>'quote_count')::integer IS DISTINCT FROM own THEN
    RAISE EXCEPTION 'TENANT B DASHBOARD LEAK';
  END IF;
END $$;
ROLLBACK;
SELECT 'Dashboard metrics are server-computed and tenant scoped PASSED' AS result;
