-- Archived quotes are read-only and recoverable, with optimistic versioning.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claims='{"aal":"aal2"}';
DO $$
DECLARE v integer; next_version integer; n integer; denied boolean;
BEGIN
  SELECT version INTO v FROM public.budgets
    WHERE id='00000000-0000-4000-8000-000000000200';
  IF v IS NULL THEN RAISE EXCEPTION 'MISSING FIXTURE'; END IF;
  SELECT version INTO next_version FROM public.tercis_set_budget_archive(
    '00000000-0000-4000-8000-000000000200',v,true);
  IF next_version<>v+1 THEN RAISE EXCEPTION 'ARCHIVE DID NOT INCREMENT VERSION'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.budgets
    WHERE id='00000000-0000-4000-8000-000000000200' AND archived_at IS NOT NULL)
  THEN RAISE EXCEPTION 'QUOTE NOT ARCHIVED'; END IF;

  denied:=false;
  BEGIN
    UPDATE public.budgets SET name='Forbidden edit'
    WHERE id='00000000-0000-4000-8000-000000000200';
    GET DIAGNOSTICS n=ROW_COUNT;
    denied:=n=0;
  EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'ARCHIVED BUDGET EDITED'; END IF;

  denied:=false;
  BEGIN
    PERFORM public.tercis_transition_budget(
      '00000000-0000-4000-8000-000000000200','aceite',next_version);
  EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'ARCHIVED QUOTE STATUS TRANSITION ACCEPTED'; END IF;

  denied:=false;
  BEGIN
    PERFORM public.tercis_set_budget_archive(
      '00000000-0000-4000-8000-000000000200',v,false);
  EXCEPTION WHEN SQLSTATE '40001' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'ARCHIVE STALE VERSION ACCEPTED'; END IF;

  SELECT version INTO next_version FROM public.tercis_set_budget_archive(
    '00000000-0000-4000-8000-000000000200',next_version,false);
  IF next_version<>v+2 OR NOT EXISTS(
    SELECT 1 FROM public.budgets WHERE id='00000000-0000-4000-8000-000000000200'
      AND archived_at IS NULL
  ) THEN RAISE EXCEPTION 'ARCHIVE RESTORE DID NOT COMPLETE'; END IF;

  SELECT count(*) INTO n FROM public.audit_logs WHERE entity_type='budget'
    AND entity_id='00000000-0000-4000-8000-000000000200'
    AND action IN ('quote_archived','quote_restored');
  IF n<>2 THEN RAISE EXCEPTION 'ARCHIVE AUDIT RECORDS MISSING: %',n; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000007';
DO $$
DECLARE denied boolean:=false; v integer;
BEGIN
  SELECT version INTO v FROM public.budgets
    WHERE id='00000000-0000-4000-8000-000000000280';
  BEGIN
    PERFORM public.tercis_set_budget_archive(
      '00000000-0000-4000-8000-000000000200',4,true);
  EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'OTHER TENANT COULD ARCHIVE QUOTE'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claims='{"aal":"aal1"}';
DO $$
DECLARE denied boolean:=false;
BEGIN
  BEGIN
    PERFORM public.tercis_set_budget_archive(
      '00000000-0000-4000-8000-000000000200',4,true);
  EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'AAL1 ARCHIVED QUOTE'; END IF;
END $$;
ROLLBACK;
SELECT 'Reversible archived quote, versioning, tenant security and audit PASSED' AS result;
