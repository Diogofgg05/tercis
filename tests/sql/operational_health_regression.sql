-- Only the service credential may query operational aggregates.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claims='{"aal":"aal2"}';
DO $$
DECLARE denied boolean:=false;
BEGIN
  BEGIN
    PERFORM public.tercis_operational_health();
  EXCEPTION WHEN insufficient_privilege OR SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'MANAGER READ GLOBAL OPERATIONS'; END IF;
END $$;
SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claim.role='service_role';
DO $$
DECLARE health jsonb; metric text;
BEGIN
  SELECT public.tercis_operational_health() INTO health;
  FOREACH metric IN ARRAY ARRAY[
    'stale_email_queue','stuck_email_workers',
    'pending_attachment_scans','stuck_attachment_scans',
    'scan_errors','malware_detected','email_bounces','orphan_files_over_48h'
  ] LOOP
    IF NOT health ? metric OR (health->>metric)::int<0 THEN
      RAISE EXCEPTION 'MISSING OPERATIONS METRIC %',metric;
    END IF;
  END LOOP;
  IF health ? 'recipient_email' OR health ? 'company_id' THEN
    RAISE EXCEPTION 'SENSITIVE DATA IN OPERATIONS METRICS';
  END IF;
END $$;
ROLLBACK;
SELECT 'Service-only operational monitoring PASSED' AS result;
