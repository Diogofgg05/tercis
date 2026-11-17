-- Regression tests for published quote privacy and platform profile isolation.
-- Run after all existing fixture tests. This database contains demo records only.

-- These are internal review outcomes, never sent to the customer.
INSERT INTO public.budgets(id,ref,name,company_id,created_by,status,version,notes)
VALUES
 ('00000000-0000-4000-8000-000000000240','ORC-PRIVATE-REJECTED','Internal rejection',
  '00000000-0000-4000-8000-000000000100',
  '00000000-0000-4000-8000-000000000001','rejeitado',1,'UNSENT_REVIEW_SECRET'),
 ('00000000-0000-4000-8000-000000000241','ORC-PRIVATE-CHANGES','Internal change request',
  '00000000-0000-4000-8000-000000000100',
  '00000000-0000-4000-8000-000000000001','pedido_alteracoes',1,'UNSENT_CHANGE_SECRET');

INSERT INTO public.budget_messages(budget_id,company_id,sender_id,body,visibility)
VALUES('00000000-0000-4000-8000-000000000240',
 '00000000-0000-4000-8000-000000000100',
 '00000000-0000-4000-8000-000000000001',
 'UNSENT_MESSAGE_SECRET','client');

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';
DO $$
DECLARE quotes jsonb; messages jsonb;
BEGIN
  SELECT public.tercis_client_quote_feed() INTO quotes;
  SELECT public.tercis_client_message_feed() INTO messages;
  IF jsonb_array_length(quotes)<>1 OR quotes::text LIKE '%UNSENT_%' THEN
    RAISE EXCEPTION 'UNPUBLISHED INTERNAL REVIEW LEAKED TO CUSTOMER QUOTE FEED: %',quotes;
  END IF;
  IF jsonb_array_length(messages)<>1 OR messages::text LIKE '%UNSENT_%' THEN
    RAISE EXCEPTION 'UNPUBLISHED INTERNAL REVIEW LEAKED TO CUSTOMER MESSAGE FEED: %',messages;
  END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000006';
DO $$
DECLARE n integer; changed integer;
BEGIN
  SELECT count(*) INTO n FROM public.profiles;
  IF n<>1 THEN RAISE EXCEPTION 'PLATFORM ADMIN CAN READ % PROFILES (EXPECTED 1)',n; END IF;
  DELETE FROM public.profiles WHERE id='00000000-0000-4000-8000-000000000003';
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>0 THEN RAISE EXCEPTION 'PLATFORM ADMIN DELETED ANOTHER PROFILE'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
DO $$
DECLARE updated integer; v record;
BEGIN
  -- A sent quote can be rejected, but its prices cannot change while the
  -- rejected quote remains visible in the client portal.
  SELECT * INTO v FROM public.tercis_transition_budget(
    '00000000-0000-4000-8000-000000000200','rejeitado',4);

  UPDATE public.budgets SET name='Tampered rejected published quote'
    WHERE id='00000000-0000-4000-8000-000000000200';
  -- The UPDATE must have thrown via the commercial lock.
  RAISE EXCEPTION 'EXPECTED A REJECTED PUBLISHED QUOTE TO BE IMMUTABLE';
EXCEPTION WHEN SQLSTATE '42501' THEN
  -- Test that the protected commercial update was rejected.
  NULL;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
DO $$
DECLARE blocked boolean:=false; v record;
BEGIN
  SELECT * INTO v FROM public.tercis_transition_budget(
    '00000000-0000-4000-8000-000000000200','rejeitado',4);
  BEGIN
    UPDATE public.budgets SET name='Hacked quote'
      WHERE id='00000000-0000-4000-8000-000000000200';
  EXCEPTION WHEN SQLSTATE '42501' THEN blocked:=true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'REJECTED SENT QUOTE WAS EDITABLE'; END IF;

  INSERT INTO public.budget_items(budget_id,code,quantity,unit_cost)
    VALUES('00000000-0000-4000-8000-000000000200','UNAUTH-PRICE',1,1);
  RAISE EXCEPTION 'EXPECTED INSERT TO BE BLOCKED BY PUBLICATION GUARD';
EXCEPTION WHEN insufficient_privilege OR check_violation THEN
  NULL;
END $$;
ROLLBACK;

SELECT 'Published quote feed and platform profile privacy tests PASSED' AS result;
