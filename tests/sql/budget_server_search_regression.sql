-- Search results must honor tenant RLS, ownership and company name matches.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claims='{"aal":"aal2"}';
DO $$
DECLARE n int; v_id uuid;
BEGIN
  SELECT count(*) INTO n FROM public.tercis_budget_search_ids('', '', false,0,100);
  IF n<1 THEN RAISE EXCEPTION 'OWN ORGANIZATION SEARCH EMPTY'; END IF;
  SELECT count(*) INTO n FROM public.tercis_budget_search_ids('Private B quote','',false,0,100);
  IF n<>0 THEN RAISE EXCEPTION 'CROSS-TENANT QUOTE SEARCH LEAK'; END IF;
  SELECT count(*) INTO n FROM public.tercis_budget_search_ids('NOT-A-QUOTE','',false,0,100);
  IF n<>0 THEN RAISE EXCEPTION 'SEARCH RETURNED UNRELATED QUOTES'; END IF;
  SELECT count(*) INTO n FROM public.tercis_budget_search_ids('', 'rascunho',false,0,100)
    q JOIN public.budgets b ON b.id=q.id WHERE b.status<>'rascunho';
  IF n<>0 THEN RAISE EXCEPTION 'STATUS FILTER IGNORED'; END IF;
  SELECT count(*) INTO n FROM public.tercis_budget_search_ids('', '',true,0,100)
    q JOIN public.budgets b ON b.id=q.id WHERE b.archived_at IS NULL;
  IF n<>0 THEN RAISE EXCEPTION 'ARCHIVE FILTER IGNORED'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';
DO $$
DECLARE denied boolean:=false;
BEGIN
  BEGIN
    PERFORM public.tercis_budget_search_ids('', '',false,0,100);
  EXCEPTION WHEN insufficient_privilege OR SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'CLIENT MAY QUERY RAW STAFF BUDGETS'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000007';
SET LOCAL request.jwt.claims='{"aal":"aal2"}';
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.tercis_budget_search_ids('Private B quote','',false,0,100);
  IF n<>1 THEN RAISE EXCEPTION 'SECOND TENANT CANNOT SEARCH OWN QUOTE'; END IF;
  SELECT count(*) INTO n FROM public.tercis_budget_search_ids('', '',false,0,100)
    WHERE id='00000000-0000-4000-8000-000000000200';
  IF n<>0 THEN RAISE EXCEPTION 'SECOND TENANT SEARCHED A QUOTE'; END IF;
END $$;
ROLLBACK;
SELECT 'Tenant-scoped budget search and status/archive filters PASSED' AS result;
