-- Purchase prices are private to tenant managers; history is append-only.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claims='{"aal":"aal2"}';
DO $$
DECLARE v_id uuid; n integer; history jsonb;
BEGIN
  INSERT INTO public.custom_catalog_items(
    organization_id,created_by,code,description,unit_cost,supplier,active
  ) VALUES (
    '00000000-0000-4000-8000-000000000900',auth.uid(),
    'AUDIT-PRICE-TEST','Historical unit cost',10.2345,'Supplier One',true
  ) RETURNING id INTO v_id;
  UPDATE public.custom_catalog_items
    SET unit_cost=11.7890,supplier='Supplier Two' WHERE id=v_id;
  history:=public.tercis_catalog_price_history(v_id);
  IF jsonb_array_length(history)<>1 OR
     (history->0->>'old_cost')::numeric<>10.2345 OR
     (history->0->>'new_cost')::numeric<>11.7890 OR
     history->0->>'new_supplier'<>'Supplier Two'
  THEN RAISE EXCEPTION 'PURCHASE PRICE HISTORY NOT REPRODUCIBLE'; END IF;
  UPDATE public.custom_catalog_items SET description='Updated description' WHERE id=v_id;
  history:=public.tercis_catalog_price_history(v_id);
  IF jsonb_array_length(history)<>1 THEN
    RAISE EXCEPTION 'UNCHANGED PURCHASE PRICE CREATED HISTORY'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';
DO $$
DECLARE denied boolean:=false;
BEGIN
  BEGIN
    PERFORM public.tercis_catalog_price_history(
      '00000000-0000-4000-8000-000000000001'::uuid);
  EXCEPTION WHEN insufficient_privilege OR SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'CUSTOMER READ SUPPLIER PRICE HISTORY'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000007';
SET LOCAL request.jwt.claims='{"aal":"aal2"}';
DO $$
DECLARE denied boolean:=false; other_item uuid;
BEGIN
  SELECT id INTO other_item FROM public.custom_catalog_items
    WHERE organization_id='00000000-0000-4000-8000-000000000901'
    LIMIT 1;
  IF other_item IS NULL THEN RAISE EXCEPTION 'TENANT B CATALOG FIXTURE MISSING'; END IF;
  BEGIN
    PERFORM public.tercis_catalog_price_history(
      '00000000-0000-4000-8000-000000000001'::uuid);
  EXCEPTION WHEN insufficient_privilege OR SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'OTHER TENANT READ FOREIGN PRICE HISTORY'; END IF;
END $$;
ROLLBACK;
SELECT 'Private catalog purchase price history PASSED' AS result;
