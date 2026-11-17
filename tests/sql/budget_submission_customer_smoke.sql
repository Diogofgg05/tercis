-- No customer => cannot submit, even if the caller bypasses the UI.
INSERT INTO public.budgets(id,ref,name,company_id,created_by,assigned_to,status,version)
VALUES ('00000000-0000-4000-8000-000000000232','ORC-CLIENT-REQUIRED',
        'Customer required',NULL,'00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000001','rascunho',1);

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
DO $$
DECLARE blocked boolean:=false;
DECLARE result_record record;
BEGIN
  BEGIN
    PERFORM public.tercis_transition_budget(
      '00000000-0000-4000-8000-000000000232',
      'pendente_aprovacao',1
    );
  EXCEPTION WHEN SQLSTATE '22023' THEN blocked:=true;
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION 'UNASSIGNED DRAFT SUBMISSION WAS ALLOWED';
  END IF;
  -- Customer assignment is an administrator action while still in draft.
  UPDATE public.budgets
     SET company_id='00000000-0000-4000-8000-000000000100'
   WHERE id='00000000-0000-4000-8000-000000000232';

  SELECT * INTO result_record
  FROM public.tercis_transition_budget(
    '00000000-0000-4000-8000-000000000232',
    'pendente_aprovacao',1
  );
  IF result_record.status<>'pendente_aprovacao' OR result_record.version<>2 THEN
    RAISE EXCEPTION 'VALID CUSTOMER-ASSIGNED SUBMISSION FAILED';
  END IF;
END $$;
ROLLBACK;

SELECT 'Budget submission requires associated customer PASSED' AS result;
