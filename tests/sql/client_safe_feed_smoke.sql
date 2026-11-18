-- Ensure clients receive totals only, not wholesale costs or secret notes.
-- The quote and its priced line were seeded before the status-smoke publication.

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';
DO $$
DECLARE n integer;
DECLARE feed jsonb;
DECLARE messages jsonb;
DECLARE item jsonb;
BEGIN
  SELECT count(*) INTO n FROM public.budgets;
  IF n <> 0 THEN RAISE EXCEPTION 'CLIENT CAN READ RAW BUDGET RECORDS'; END IF;
  SELECT count(*) INTO n FROM public.budget_items;
  IF n <> 0 THEN RAISE EXCEPTION 'CLIENT CAN READ RAW ITEM COSTS'; END IF;

  SELECT public.tercis_client_quote_feed() INTO feed;
  IF jsonb_array_length(feed)<>1 THEN RAISE EXCEPTION 'CLIENT FEED DOES NOT SHOW SENT QUOTE'; END IF;
  IF (feed::text LIKE '%INTERNAL_MARGIN_NOTE%') OR (feed::text LIKE '%STAFF_PRIVATE_CONTACT%')
    OR (feed::text LIKE '%secret@example.test%') THEN
    RAISE EXCEPTION 'CLIENT FEED LEAKED INTERNAL BUDGET DETAILS';
  END IF;
  item := feed->0->'items'->0;
  IF item IS NULL THEN RAISE EXCEPTION 'CLIENT SAFE ITEM IS MISSING'; END IF;
  IF item ? 'unit_cost' OR item ? 'margin' OR item ? 'discount' THEN
    RAISE EXCEPTION 'CLIENT SAFE ITEM EXPOSES INTERNAL PRICE COMPONENTS';
  END IF;
  IF (item->>'unit_price')::numeric <> 108 THEN
    RAISE EXCEPTION 'FINAL UNIT PRICE IS INCORRECT: %',item->>'unit_price';
  END IF;

  SELECT public.tercis_client_message_feed() INTO messages;
  IF jsonb_array_length(messages)<>1
     OR messages::text LIKE '%Internal price negotiation%'
     OR messages::text NOT LIKE '%Quote submitted%' THEN
    RAISE EXCEPTION 'CLIENT MESSAGE FEED DID NOT FILTER INTERNAL CONTENT';
  END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
DO $$
DECLARE n integer;
DECLARE denied boolean:=false;
BEGIN
  SELECT count(*) INTO n FROM public.budgets;
  IF n<>1 THEN RAISE EXCEPTION 'ADMIN LOST INTERNAL BUDGET ACCESS'; END IF;
  SELECT count(*) INTO n FROM public.budget_items;
  IF n<>1 THEN RAISE EXCEPTION 'ADMIN LOST COST DATA'; END IF;
  BEGIN
    PERFORM public.tercis_client_quote_feed();
  EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'STAFF ACCESS GRANTED TO CLIENT-ONLY FEED'; END IF;
END $$;
ROLLBACK;

SELECT 'Redacted client quote and message feed tests PASSED' AS result;
