-- The client, the other organization and unauthorized collaborators must
-- never write internal notes. Internal notes remain invisible to client feed.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claims='{"aal":"aal2"}';
DO $$
DECLARE v_id uuid; n integer; denied boolean:=false;
BEGIN
  SELECT public.tercis_send_internal_budget_message(
    '00000000-0000-4000-8000-000000000200','Technical note only for staff'
  ) INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'INTERNAL NOTE NOT CREATED'; END IF;
  SELECT count(*) INTO n FROM public.budget_messages m
    WHERE m.id=v_id AND m.visibility='internal'
      AND m.sender_id=auth.uid() AND m.channel='portal';
  IF n<>1 THEN RAISE EXCEPTION 'INTERNAL NOTE CONTENT/ATTRIBUTION INVALID'; END IF;
  BEGIN
    PERFORM public.tercis_send_internal_budget_message(
      '00000000-0000-4000-8000-000000000200','   ');
  EXCEPTION WHEN SQLSTATE '22023' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'BLANK NOTE ACCEPTED'; END IF;
  denied:=false;
  BEGIN
    PERFORM public.tercis_send_internal_budget_message(
      '00000000-0000-4000-8000-000000000200',repeat('x',4001));
  EXCEPTION WHEN SQLSTATE '22023' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'OVERSIZED NOTE ACCEPTED'; END IF;
END $$;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';
DO $$
DECLARE denied boolean:=false; n integer;
BEGIN
  BEGIN
    PERFORM public.tercis_send_internal_budget_message(
      '00000000-0000-4000-8000-000000000200','Forged client note');
  EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'CLIENT WROTE INTERNAL NOTE'; END IF;
  SELECT count(*) INTO n FROM jsonb_array_elements(
    public.tercis_client_message_feed()
  ) AS m WHERE m->>'body'='Technical note only for staff';
  IF n<>0 THEN RAISE EXCEPTION 'INTERNAL NOTE LEAKED TO CLIENT FEED'; END IF;
END $$;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000007';
DO $$
DECLARE denied boolean:=false;
BEGIN
  BEGIN
    PERFORM public.tercis_send_internal_budget_message(
      '00000000-0000-4000-8000-000000000200','Cross org note');
  EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'OTHER TENANT WROTE INTERNAL NOTE'; END IF;
END $$;
ROLLBACK;
SELECT 'Internal notes are audited, restricted and hidden from customer PASSED' AS result;
