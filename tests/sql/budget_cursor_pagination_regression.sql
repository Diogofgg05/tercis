-- Keyset cursor regression: non-overlapping pages even after concurrent inserts,
-- tenant isolation and rejection of customer-side raw search.
BEGIN;
DO $setup$
DECLARE v_org uuid; n integer;
BEGIN
  SELECT organization_id INTO v_org FROM public.profiles
    WHERE id='00000000-0000-4000-8000-000000000001';
  IF v_org IS NULL THEN RAISE EXCEPTION 'TEST TENANT MISSING'; END IF;
  FOR n IN 1..4 LOOP
    INSERT INTO public.budgets(
      id,ref,name,organization_id,created_by,status,created_at
    ) VALUES (
      gen_random_uuid(),'CURSOR-TEST-'||n::text,
      'CURSORREGRESSION document '||n::text,v_org,
      '00000000-0000-4000-8000-000000000001',
      'rascunho',now()+((10-n)*interval '1 day')
    );
  END LOOP;
END;
$setup$;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claims='{"aal":"aal2"}';
DO $check$
DECLARE
  v_first uuid;v_first_at timestamptz;
  v_second uuid;v_second_at timestamptz;
  v_count integer;v_page_ids uuid[];
  v_org uuid;
BEGIN
  SELECT count(*) INTO v_count
    FROM public.tercis_budget_search_cursor('CURSORREGRESSION','',false,NULL,NULL,2);
  IF v_count<>3 THEN
    RAISE EXCEPTION 'FIRST PAGE SHOULD HAVE TWO ROWS PLUS SENTINEL; FOUND %',v_count;
  END IF;
  SELECT q.id,q.created_at INTO v_first,v_first_at
    FROM public.tercis_budget_search_cursor('CURSORREGRESSION','',false,NULL,NULL,2) q
    LIMIT 1;
  SELECT q.id,q.created_at INTO v_second,v_second_at
    FROM public.tercis_budget_search_cursor('CURSORREGRESSION','',false,NULL,NULL,2) q
    OFFSET 1 LIMIT 1;
  IF v_first=v_second OR v_first_at<v_second_at THEN
    RAISE EXCEPTION 'CURSOR SORTING FAILED';
  END IF;

  -- A different session could insert a newer record before the second page.
  -- Inserting as this authorized actor models the same database change.
  SELECT organization_id INTO v_org FROM public.profiles
    WHERE id='00000000-0000-4000-8000-000000000001';
  INSERT INTO public.budgets(id,ref,name,organization_id,created_by,status,created_at)
    VALUES(gen_random_uuid(),'CURSOR-TEST-NEW',
      'CURSORREGRESSION document NEW',v_org,
      '00000000-0000-4000-8000-000000000001',
      'rascunho',now()+interval '20 days');

  SELECT array_agg(page.id) INTO v_page_ids FROM (
    SELECT q.id FROM public.tercis_budget_search_cursor(
      'CURSORREGRESSION','',false,v_second_at,v_second,2
    ) q LIMIT 2
  ) page;
  IF cardinality(v_page_ids)<>2 OR v_first=ANY(v_page_ids)
      OR v_second=ANY(v_page_ids) THEN
    RAISE EXCEPTION 'PAGES DUPLICATED OR SKIPPED DOCUMENTS';
  END IF;
  SELECT count(*) INTO v_count FROM public.tercis_budget_search_cursor(
    'NOT-A-QUOTE','',false,NULL,NULL,2);
  IF v_count<>0 THEN RAISE EXCEPTION 'SEARCH FILTER WAS IGNORED'; END IF;
  SELECT count(*) INTO v_count FROM public.tercis_budget_search_cursor(
    'Private B quote','',false,NULL,NULL,2);
  IF v_count<>0 THEN RAISE EXCEPTION 'FOREIGN TENANT SEARCH LEAK'; END IF;
  BEGIN
    PERFORM public.tercis_budget_search_cursor(
      'CURSORREGRESSION','',false,now(),NULL,2
    );
    RAISE EXCEPTION 'INCOMPLETE CURSOR ACCEPTED';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
END;
$check$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';
DO $deny$
DECLARE v_denied boolean:=false;
BEGIN
  BEGIN
    PERFORM public.tercis_budget_search_cursor('', '', false,NULL,NULL,20);
  EXCEPTION WHEN SQLSTATE '42501' THEN v_denied:=true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'CLIENT CAN USE INTERNAL SEARCH'; END IF;
END;
$deny$;
ROLLBACK;
SELECT 'Stable keyset pagination, invalid cursors, and tenant RLS PASSED' AS result;
