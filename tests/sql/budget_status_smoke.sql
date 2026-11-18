-- Verify immutable workflow rules and customer acceptance in PostgreSQL.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
DO $$
DECLARE v_id uuid:='00000000-0000-4000-8000-000000000200';
DECLARE denied boolean:=false;
DECLARE v_result record;
BEGIN
  -- Bypassing the React UI must not permit arbitrary status assignments.
  BEGIN
    UPDATE public.budgets SET status='concluido' WHERE id=v_id;
  EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'DIRECT INVALID STATUS CHANGE ACCEPTED'; END IF;

  SELECT * INTO v_result FROM public.tercis_transition_budget(v_id,'pendente_aprovacao',1);
  IF v_result.version<>2 OR v_result.status<>'pendente_aprovacao' THEN
    RAISE EXCEPTION 'SUBMISSION FAILED';
  END IF;
  SELECT * INTO v_result FROM public.tercis_transition_budget(v_id,'aprovado',2);
  IF v_result.version<>3 THEN RAISE EXCEPTION 'APPROVAL FAILED'; END IF;
  SELECT * INTO v_result FROM public.tercis_transition_budget(v_id,'enviado',3);
  IF v_result.version<>4 THEN RAISE EXCEPTION 'SENDING FAILED'; END IF;

  denied:=false;
  BEGIN
    PERFORM public.tercis_transition_budget(v_id,'expirado',2);
  EXCEPTION WHEN SQLSTATE '40001' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'STALE STATUS CHANGE ACCEPTED'; END IF;
END $$;
COMMIT;

-- A different collaborator has no ownership or assignment for this quote.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000003';
DO $$
DECLARE denied boolean:=false;
BEGIN
  BEGIN
    PERFORM public.tercis_transition_budget(
      '00000000-0000-4000-8000-000000000200','expirado',4);
  EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'NON-ASSIGNED STAFF CHANGED STATUS'; END IF;
END $$;
ROLLBACK;

-- A client with the matching company can accept a sent quote.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';
DO $$
DECLARE v_result record;
DECLARE denied boolean:=false;
BEGIN
  SELECT * INTO v_result FROM public.tercis_transition_budget(
    '00000000-0000-4000-8000-000000000200','aceite',4);
  IF v_result.version<>5 OR v_result.status<>'aceite' THEN
    RAISE EXCEPTION 'CUSTOMER ACCEPTANCE FAILED';
  END IF;
  BEGIN
    PERFORM public.tercis_transition_budget(
      '00000000-0000-4000-8000-000000000200','concluido',5);
  EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'CUSTOMER COMPLETED INTERNAL WORK'; END IF;
END $$;
ROLLBACK;

-- Keep the fixture consistent; tests must not mutate a production database.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.audit_logs
    WHERE entity_id='00000000-0000-4000-8000-000000000200' AND action='status_changed';
  IF n<>3 THEN RAISE EXCEPTION 'STATUS TRANSITION AUDIT MISSING: %',n; END IF;
END $$;
ROLLBACK;
SELECT 'Budget lifecycle transition rules PASSED' AS result;
