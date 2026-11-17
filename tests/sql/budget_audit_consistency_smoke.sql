-- Direct SQL update must never skip version control and audit.
INSERT INTO public.budgets(id,ref,name,company_id,created_by,status,version)
VALUES('00000000-0000-4000-8000-000000000250','ORC-AUDIT-TEST',
  'Direct transition test','00000000-0000-4000-8000-000000000100',
  '00000000-0000-4000-8000-000000000001','rascunho',1);
INSERT INTO public.budget_items(budget_id,code,description,quantity,unit_cost,margin,discount)
VALUES ('00000000-0000-4000-8000-000000000250','CABLE','Cable',1,5,20,0);

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
DO $$
DECLARE blocked boolean:=false;
DECLARE n int;
BEGIN
  BEGIN
    UPDATE public.budgets SET status='pendente_aprovacao'
    WHERE id='00000000-0000-4000-8000-000000000250';
  EXCEPTION WHEN SQLSTATE '40001' THEN blocked:=true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'STATUS UPDATE ACCEPTED WITHOUT VERSION BUMP'; END IF;

  UPDATE public.budgets SET status='pendente_aprovacao',version=version+1
  WHERE id='00000000-0000-4000-8000-000000000250';

  SELECT count(*) INTO n FROM public.audit_logs
  WHERE entity_id='00000000-0000-4000-8000-000000000250'
    AND action='status_changed'
    AND metadata->>'from'='rascunho'
    AND metadata->>'to'='pendente_aprovacao'
    AND (metadata->>'version')::int=2;
  IF n<>1 THEN RAISE EXCEPTION 'DIRECT TRANSITION AUDIT MISSING: %',n; END IF;

  PERFORM public.tercis_transition_budget(
    '00000000-0000-4000-8000-000000000250','aprovado',2);

  SELECT count(*) INTO n FROM public.audit_logs
  WHERE entity_id='00000000-0000-4000-8000-000000000250'
    AND action='status_changed';
  IF n<>2 THEN RAISE EXCEPTION 'RPC TRANSITION DUPLICATED OR LOST AUDIT: %',n; END IF;
END $$;
ROLLBACK;

SELECT 'Quote transition audit consistency PASSED' AS result;
