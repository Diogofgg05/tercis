-- Full reports must read all budget rows visible by RLS and never include
-- proposals belonging to a different organization.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claims='{"aal":"aal2"}';
DO $$
DECLARE report jsonb; expected bigint; total_months bigint;
BEGIN
  report:=public.tercis_report_summary(12,'',NULL);
  SELECT count(*) INTO expected FROM public.budgets b
  WHERE b.archived_at IS NULL
    AND b.date >= (date_trunc('month',current_date)-interval '11 months')::date
    AND b.date < (date_trunc('month',current_date)+interval '1 month')::date;
  IF (report->>'count')::bigint IS DISTINCT FROM expected
    OR jsonb_array_length(report->'months')<>12 THEN
    RAISE EXCEPTION 'REPORT DOES NOT COVER ALL AUTHORIZED PROPOSALS: %',report;
  END IF;
  SELECT sum((entry->>'count')::bigint) INTO total_months
  FROM jsonb_array_elements(report->'months') AS entry;
  IF total_months IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'REPORT MONTHS DO NOT MATCH TOTAL';
  END IF;
  report:=public.tercis_report_summary(6,'rascunho',NULL);
  IF EXISTS(
    SELECT 1 FROM jsonb_array_elements(report->'by_status') entry
    WHERE entry->>'status'<>'rascunho'
  ) THEN RAISE EXCEPTION 'REPORT STATUS FILTER LEAK'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';
DO $$
DECLARE blocked boolean:=false;
BEGIN
  BEGIN
    PERFORM public.tercis_report_summary(12,'',NULL);
  EXCEPTION WHEN insufficient_privilege OR SQLSTATE '42501' THEN blocked:=true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'CLIENT READ STAFF REPORTS'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000007';
SET LOCAL request.jwt.claims='{"aal":"aal2"}';
DO $$
DECLARE report jsonb; expected bigint;
BEGIN
  report:=public.tercis_report_summary(12,'',NULL);
  SELECT count(*) INTO expected FROM public.budgets b
  WHERE b.archived_at IS NULL
    AND b.date >= (date_trunc('month',current_date)-interval '11 months')::date
    AND b.date < (date_trunc('month',current_date)+interval '1 month')::date;
  IF (report->>'count')::bigint IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'SECOND TENANT REPORT CROSSED RLS BOUNDARY'; END IF;
END $$;
ROLLBACK;
SELECT 'Full server-side reports and tenant privacy PASSED' AS result;
