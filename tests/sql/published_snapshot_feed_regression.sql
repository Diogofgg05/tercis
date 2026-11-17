-- Public portal must render the LAST SENT VERSION, even while staff
-- edits or reassigns a new draft. Publication is NOT equivalent to sent_at IS NOT NULL.
INSERT INTO auth.users(id,email,raw_user_meta_data)
VALUES ('00000000-0000-4000-8000-000000000011','second-client@example.test','{}');
UPDATE public.profiles SET role='client',active=true,
 organization_id='00000000-0000-4000-8000-000000000900',
 company_id='00000000-0000-4000-8000-000000000101'
WHERE id='00000000-0000-4000-8000-000000000011';

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
DO $$
DECLARE v record;
BEGIN
  SELECT * INTO v FROM public.tercis_transition_budget(
    '00000000-0000-4000-8000-000000000200','rejeitado',4);
  SELECT * INTO v FROM public.tercis_transition_budget(
    '00000000-0000-4000-8000-000000000200','rascunho',5);
  UPDATE public.budgets SET name='DRAFT_NOT_PUBLISHED',notes='PRIVATE_REVIEW_NOTE'
  WHERE id='00000000-0000-4000-8000-000000000200';
  UPDATE public.budget_items SET unit_cost=99999,description='PRIVATE_UNSENT_LINE'
  WHERE budget_id='00000000-0000-4000-8000-000000000200';
  INSERT INTO public.budget_messages(budget_id,company_id,sender_id,body,visibility)
  VALUES('00000000-0000-4000-8000-000000000200',
    '00000000-0000-4000-8000-000000000100',
    '00000000-0000-4000-8000-000000000001',
    'DRAFT_NOT_PUBLISHED_MESSAGE','client');
END $$;

-- PostgreSQL SET LOCAL ROLE changes privileges without committing the draft.
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';
DO $$
DECLARE quotes jsonb; messages jsonb;
BEGIN
  SELECT public.tercis_client_quote_feed() INTO quotes;
  SELECT public.tercis_client_message_feed() INTO messages;
  IF jsonb_array_length(quotes)<>1
    OR quotes->0->>'name'<>'Test Quote'
    OR (quotes->0->>'version')::int<>4
    OR (quotes->0->'items'->0->>'unit_price')::numeric<>108 THEN
    RAISE EXCEPTION 'CLIENT DID NOT RECEIVE LAST SENT VERSION: %',quotes;
  END IF;
  IF quotes::text LIKE '%DRAFT_NOT_PUBLISHED%'
    OR quotes::text LIKE '%PRIVATE_UNSENT_LINE%'
    OR quotes::text LIKE '%99999%' OR quotes::text LIKE '%unit_cost%' THEN
    RAISE EXCEPTION 'INTERNAL REVISION LEAKED TO CUSTOMER: %',quotes;
  END IF;
  IF messages::text LIKE '%DRAFT_NOT_PUBLISHED_MESSAGE%' THEN
    RAISE EXCEPTION 'UNPUBLISHED REVISION MESSAGE LEAKED TO CUSTOMER';
  END IF;
END $$;

SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
DO $$
BEGIN
  -- A later internal revision is associated with a DIFFERENT customer.
  -- This must not retroactively transfer the old published quote.
  UPDATE public.budgets SET company_id='00000000-0000-4000-8000-000000000101'
  WHERE id='00000000-0000-4000-8000-000000000200';
  PERFORM public.tercis_transition_budget(
    '00000000-0000-4000-8000-000000000200','pendente_aprovacao',6);
  PERFORM public.tercis_transition_budget(
    '00000000-0000-4000-8000-000000000200','rejeitado',7);
END $$;

SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';
DO $$
DECLARE q jsonb;
BEGIN
  SELECT public.tercis_client_quote_feed() INTO q;
  IF jsonb_array_length(q)<>1 OR q->0->>'name'<>'Test Quote'
    OR q->0->>'status'<>'enviado' THEN
    RAISE EXCEPTION 'INTERNAL REJECTION CHANGED PREVIOUSLY PUBLISHED QUOTE: %',q;
  END IF;
END $$;

SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000011';
DO $$
DECLARE q jsonb;
BEGIN
  SELECT public.tercis_client_quote_feed() INTO q;
  IF jsonb_array_length(q)<>0 THEN
    RAISE EXCEPTION 'UNPUBLISHED NEW RECIPIENT GOT OLD CLIENT QUOTE: %',q;
  END IF;
END $;

-- Once the NEW revision is approved and published to the new recipient, each
-- customer must continue seeing only the specific version sent to them.
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
DO $
BEGIN
  PERFORM public.tercis_transition_budget(
    '00000000-0000-4000-8000-000000000200','rascunho',8);
  PERFORM public.tercis_transition_budget(
    '00000000-0000-4000-8000-000000000200','pendente_aprovacao',9);
  PERFORM public.tercis_transition_budget(
    '00000000-0000-4000-8000-000000000200','aprovado',10);
  PERFORM public.tercis_transition_budget(
    '00000000-0000-4000-8000-000000000200','enviado',11);
END $;

SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';
DO $
DECLARE q jsonb;
BEGIN
  SELECT public.tercis_client_quote_feed() INTO q;
  IF jsonb_array_length(q)<>1 OR (q->0->>'version')::int<>4
    OR q->0->>'name'<>'Test Quote' THEN
    RAISE EXCEPTION 'ORIGINAL RECIPIENT LOST THEIR SENT VERSION: %',q;
  END IF;
END $;

SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000011';
DO $
DECLARE q jsonb;
BEGIN
  SELECT public.tercis_client_quote_feed() INTO q;
  IF jsonb_array_length(q)<>1 OR (q->0->>'version')::int<>12
    OR q->0->>'name'<>'DRAFT_NOT_PUBLISHED'
    OR (q->0->'items'->0->>'unit_price')::numeric<=108 THEN
    RAISE EXCEPTION 'NEW RECIPIENT DID NOT RECEIVE JUST THE NEW VERSION: %',q;
  END IF;
END $;
ROLLBACK;

-- The B tenant's confirmed publication still works via a private snapshot.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000008';
DO $$
DECLARE q jsonb;
BEGIN
  SELECT public.tercis_client_quote_feed() INTO q;
  IF jsonb_array_length(q)<>1 OR q->0->>'ref'<>'B-2026-001' THEN
    RAISE EXCEPTION 'OTHER TENANT LOST THEIR REAL PUBLICATION: %',q;
  END IF;
END $$;
ROLLBACK;
SELECT 'Only immutable, client-owned published versions are visible PASSED' AS result;
