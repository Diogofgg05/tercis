-- Publishing and email delivery are independent. The queue must not be
-- writable by customers or other tenants, and delivery requires provider events.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claims='{"aal":"aal2"}';
DO $$
DECLARE v_id uuid; v_again uuid; n int; denied boolean:=false;
BEGIN
  UPDATE public.companies SET email='buyer@example.test'
    WHERE id='00000000-0000-4000-8000-000000000100';
  SELECT public.tercis_queue_quote_email(
      '00000000-0000-4000-8000-000000000200',4,'buyer@example.test') INTO v_id;
  SELECT public.tercis_queue_quote_email(
      '00000000-0000-4000-8000-000000000200',4,'buyer@example.test') INTO v_again;
  IF v_id IS NULL OR v_id IS DISTINCT FROM v_again THEN
    RAISE EXCEPTION 'EMAIL OUTBOX WAS DUPLICATED'; END IF;
  SELECT count(*) INTO n FROM public.quote_email_outbox WHERE id=v_id
    AND recipient_email='buyer@example.test' AND state='queued';
  IF n<>1 THEN RAISE EXCEPTION 'EMAIL QUEUE NOT OWNED BY TENANT'; END IF;
  denied:=false;
  BEGIN
    PERFORM public.tercis_queue_quote_email(
      '00000000-0000-4000-8000-000000000200',4,'wrong-recipient@example.test');
  EXCEPTION WHEN SQLSTATE '40001' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'UNCONFIRMED EMAIL RECIPIENT ACCEPTED'; END IF;
  denied:=false;
  BEGIN
    PERFORM public.tercis_queue_quote_email(
      '00000000-0000-4000-8000-000000000200',4);
  EXCEPTION WHEN insufficient_privilege THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'LEGACY UNCONFIRMED EMAIL RPC STILL CALLABLE'; END IF;
  BEGIN
    INSERT INTO public.quote_email_outbox(
      organization_id,budget_id,published_version,recipient_email
    ) VALUES(
      '00000000-0000-4000-8000-000000000900',
      '00000000-0000-4000-8000-000000000200',4,'forged@example.test');
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'DIRECT EMAIL QUEUE WRITE ACCEPTED'; END IF;
END $$;

SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';
DO $$
DECLARE denied boolean:=false; n integer;
BEGIN
  SELECT count(*) INTO n FROM public.quote_email_outbox;
  IF n<>0 THEN RAISE EXCEPTION 'CUSTOMER CAN READ PRIVATE EMAIL ADDRESSES'; END IF;
  BEGIN
    PERFORM public.tercis_queue_quote_email(
      '00000000-0000-4000-8000-000000000200',4,'buyer@example.test');
  EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'CUSTOMER QUEUED EMAIL'; END IF;
END $$;

SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claim.role='service_role';
DO $$
DECLARE v_job record; n integer; processed boolean;
BEGIN
  SELECT * INTO v_job FROM public.tercis_claim_quote_email_jobs(5);
  IF v_job.id IS NULL OR v_job.recipient_email<>'buyer@example.test' OR
    v_job.published_version<>4 OR v_job.snapshot->>'snapshot_kind'<>'sent_quote'
  THEN RAISE EXCEPTION 'WORKER CANNOT CLAIM VERIFIED PUBLISHED QUOTE'; END IF;
  UPDATE public.quote_email_outbox SET
    state='accepted',provider_id='resend-delivery-fixture',accepted_at=now()
  WHERE id=v_job.id;
  processed:=public.tercis_record_quote_email_event(
    'evt-1','resend-delivery-fixture','email.delivered');
  IF processed IS DISTINCT FROM TRUE OR NOT EXISTS(
    SELECT 1 FROM public.quote_email_outbox
    WHERE id=v_job.id AND state='delivered' AND delivered_at IS NOT NULL
  ) THEN RAISE EXCEPTION 'SIGNED PROVIDER DELIVERY EVENT NOT STORED'; END IF;
  processed:=public.tercis_record_quote_email_event(
    'evt-1','resend-delivery-fixture','email.delivered');
  IF processed IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'DUPLICATE WEBHOOK NOT IDEMPOTENT'; END IF;
  PERFORM public.tercis_record_quote_email_event(
    'evt-2','resend-delivery-fixture','email.sent');
  IF NOT EXISTS(SELECT 1 FROM public.quote_email_outbox
    WHERE id=v_job.id AND state='delivered') THEN
    RAISE EXCEPTION 'LATE ACCEPTED EVENT DOWNGRADED DELIVERED MESSAGE'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000007';
DO $$
DECLARE denied boolean:=false;
BEGIN
  BEGIN
    PERFORM public.tercis_queue_quote_email(
      '00000000-0000-4000-8000-000000000200',4,'buyer@example.test');
  EXCEPTION WHEN SQLSTATE '42501' OR SQLSTATE '40001' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'FOREIGN TENANT QUEUED EMAIL'; END IF;
END $$;
ROLLBACK;
SELECT 'Quote delivery queue and provider-confirmed state transitions PASSED' AS result;
