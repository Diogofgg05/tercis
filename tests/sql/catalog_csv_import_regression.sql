-- CSV import is atomic, scoped to actor's tenant and records cost history.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claims='{"aal":"aal2"}';
DO $$
DECLARE changed integer; v_id uuid; history jsonb; denied boolean:=false;
BEGIN
  changed:=public.tercis_import_catalog_batch('[
    {"code":"CSV-101","description":"Circuit breaker","unit_cost":22.5000,
      "supplier":"Supplier A","unit":"un"},
    {"code":"CSV-102","description":"Cable","unit_cost":1.2450,
      "supplier":"Supplier B","unit":"m"}
  ]'::jsonb);
  IF changed<>2 THEN RAISE EXCEPTION 'CSV IMPORT DID NOT CREATE TWO ITEMS'; END IF;
  SELECT id INTO v_id FROM public.custom_catalog_items
    WHERE code='CSV-101' AND organization_id='00000000-0000-4000-8000-000000000900';
  IF v_id IS NULL THEN RAISE EXCEPTION 'CSV ITEM MISSING IN OWN ORG'; END IF;

  changed:=public.tercis_import_catalog_batch('[
    {"code":"CSV-101","description":"Circuit breaker updated","unit_cost":25.7500,
      "supplier":"Supplier C","unit":"un"}
  ]'::jsonb);
  IF changed<>1 THEN RAISE EXCEPTION 'CSV UPDATE FAILED'; END IF;
  history:=public.tercis_catalog_price_history(v_id);
  IF jsonb_array_length(history)<>1 OR
    (history->0->>'old_cost')::numeric<>22.5 OR
    (history->0->>'new_cost')::numeric<>25.75 THEN
    RAISE EXCEPTION 'CSV PRICE UPDATE WAS NOT AUDITED'; END IF;

  BEGIN
    PERFORM public.tercis_import_catalog_batch('[
      {"code":"CSV-105","description":"Valid","unit_cost":10},
      {"code":"CSV-106","description":"Bad price","unit_cost":-1}
    ]'::jsonb);
  EXCEPTION WHEN SQLSTATE '22023' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'BAD CSV ROW ACCEPTED'; END IF;
  IF EXISTS(SELECT 1 FROM public.custom_catalog_items WHERE code='CSV-105')
  THEN RAISE EXCEPTION 'BAD CSV IMPORT WAS NOT ATOMIC'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';
DO $$
DECLARE denied boolean:=false;
BEGIN
  BEGIN
    PERFORM public.tercis_import_catalog_batch('[
      {"code":"FORGED-COST","description":"Unauthorized","unit_cost":5}
    ]'::jsonb);
  EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'CUSTOMER COULD IMPORT PURCHASE PRICES'; END IF;
END $$;
ROLLBACK;
SELECT 'CSV catalog import is atomic, tenant-scoped and audited PASSED' AS result;
