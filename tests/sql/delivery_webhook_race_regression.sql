-- The signed Resend webhook may arrive before the sending worker persists
-- its provider ID. Preserve, reconcile and deduplicate without a second send.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claims='{"aal":"aal2"}';
DO $$
DECLARE v_id uuid;
BEGIN
  UPDATE public.companies SET email='race@example.test'
    WHERE id='00000000-0000-4000-8000-000000000100';
  SELECT public.tercis_queue_quote_email(
    '00000000-0000-4000-8000-000000000200',4) INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'EMAIL FIXTURE NOT QUEUED'; END IF;
END $$;

SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claim.role='service_role';
DO $$
DECLARE v_job record; applied boolean; v_state text; n integer;
BEGIN
  SELECT * INTO v_job FROM public.tercis_claim_quote_email_jobs(1);
  IF v_job.id IS NULL THEN RAISE EXCEPTION 'NO CLAIMABLE EMAIL'; END IF;

  applied:=public.tercis_record_quote_email_event(
    'evt-before-register','resend-race-1','email.delivered');
  IF applied IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'EARLY WEBHOOK WAS DISCARDED'; END IF;

  SELECT count(*) INTO n FROM public.quote_email_webhook_events
    WHERE event_id='evt-before-register' AND applied_at IS NULL;
  IF n<>1 THEN RAISE EXCEPTION 'EARLY WEBHOOK NOT DURABLY PENDING'; END IF;

  v_state:=public.tercis_register_quote_email_provider(
    v_job.id,'resend-race-1');
  IF v_state<>'delivered' OR NOT EXISTS (
    SELECT 1 FROM public.quote_email_outbox
    WHERE id=v_job.id AND state='delivered' AND delivered_at IS NOT NULL
  ) THEN RAISE EXCEPTION 'EARLY WEBHOOK WAS NOT RECONCILED'; END IF;

  SELECT count(*) INTO n FROM public.quote_email_webhook_events
    WHERE event_id='evt-before-register' AND outbox_id=v_job.id
      AND applied_at IS NOT NULL;
  IF n<>1 THEN RAISE EXCEPTION 'EARLY EVENT RECONCILIATION NOT AUDITED'; END IF;

  applied:=public.tercis_record_quote_email_event(
    'evt-before-register','resend-race-1','email.delivered');
  IF applied IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'DUPLICATE EARLY EVENT ACCEPTED'; END IF;

  v_state:=public.tercis_register_quote_email_provider(v_job.id,'resend-race-1');
  IF v_state<>'delivered' THEN
    RAISE EXCEPTION 'LATE WORKER RESPONSE REGRESSED DELIVERY'; END IF;

  IF EXISTS (SELECT 1 FROM public.tercis_claim_quote_email_jobs(10)
    WHERE id=v_job.id) THEN
    RAISE EXCEPTION 'ALREADY DELIVERED EMAIL WAS CLAIMED AGAIN'; END IF;

  applied:=public.tercis_record_quote_email_event(
    'evt-different','resend-race-1','email.failed');
  SELECT state INTO v_state FROM public.quote_email_outbox WHERE id=v_job.id;
  IF v_state<>'delivered' THEN
    RAISE EXCEPTION 'LATE FAILURE DOWNGRADED DELIVERED STATE'; END IF;
END $$;
ROLLBACK;

-- The customer role must not claim or register provider IDs.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';
DO $$
DECLARE denied boolean:=false;
BEGIN
  BEGIN
    PERFORM public.tercis_register_quote_email_provider(
      '00000000-0000-4000-8000-000000000200','forged-provider');
  EXCEPTION WHEN insufficient_privilege OR SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'CUSTOMER REGISTERED PROVIDER ID'; END IF;
END $$;
ROLLBACK;
SELECT 'Early signed webhooks are reconciled, deduplicated and never retried PASSED' AS result;
