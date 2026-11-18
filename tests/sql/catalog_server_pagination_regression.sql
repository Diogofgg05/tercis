-- Parameterized SQL search must find results beyond the old 500-item
-- frontend limit without exposing costs to clients or other organizations.
BEGIN;
-- Seed fixtures as the trusted PostgreSQL migration owner.
INSERT INTO public.custom_catalog_items(
  code,description,reference,brand,category,sector,unit,unit_cost,
  organization_id,created_by,active
)
SELECT 'STRESS-'||lpad(n::text,4,'0'),
  'Catalog pagination example '||n,'REF-'||n,'TEST','Stress','Industrial',
  'un',n::numeric,
  '00000000-0000-4000-8000-000000000900',
  '00000000-0000-4000-8000-000000000001',true
FROM generate_series(1,525) n;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role='authenticated';
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claims='{"aal":"aal2"}';
DO $$
DECLARE page jsonb; next_page jsonb; n int;
BEGIN
  SELECT public.tercis_catalog_page('Catalog pagination example','Stress',0,25,'Industrial')
    INTO page;
  IF (page->>'total')::integer<>525 OR
    jsonb_array_length(page->'items')<>25 OR
    page->'items'->0->>'code'<>'STRESS-0001' THEN
    RAISE EXCEPTION 'FIRST PAGE WRONG %',page;
  END IF;
  SELECT public.tercis_catalog_page('Catalog pagination example','Stress',20,25,'Industrial')
    INTO next_page;
  IF (next_page->>'total')::integer<>525 OR
     jsonb_array_length(next_page->'items')<>25 OR
     next_page->'items'->0->>'code'<>'STRESS-0501' THEN
    RAISE EXCEPTION 'ITEMS AFTER FIRST 500 WERE UNAVAILABLE';
  END IF;
  SELECT public.tercis_catalog_page('STRESS-0525','Stress',0,100,'Industrial')
    INTO page;
  IF (page->>'total')::integer<>1 OR
     page->'items'->0->>'code'<>'STRESS-0525' THEN
    RAISE EXCEPTION 'SPECIFIC LAST ITEM SEARCH FAILED';
  END IF;
  SELECT count(*) INTO n FROM public.tercis_catalog_categories() c
    WHERE c='Stress';
  IF n<>1 THEN RAISE EXCEPTION 'CATALOG CATEGORIES NOT QUERYABLE'; END IF;
END $$;

SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';
DO $$
DECLARE blocked boolean:=false;
BEGIN
  BEGIN
    PERFORM public.tercis_catalog_page('STRESS','',0,25,'');
  EXCEPTION WHEN insufficient_privilege OR SQLSTATE '42501' THEN blocked:=true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'CUSTOMER READ COMMERCIAL COSTS'; END IF;
END $$;

SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000007';
SET LOCAL request.jwt.claims='{"aal":"aal2"}';
DO $$
DECLARE results jsonb;
BEGIN
  SELECT public.tercis_catalog_page('STRESS','',0,25,'') INTO results;
  IF (results->>'total')::integer<>0 THEN
    RAISE EXCEPTION 'CROSS-TENANT CATALOG LEAKED';
  END IF;
END $$;
ROLLBACK;
SELECT 'Server paginated catalog finds 525 items with tenant cost privacy PASSED' AS result;
