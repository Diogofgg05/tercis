-- The UI must use the version returned by the committed SQL transaction,
-- not guess from a possibly stale or paginated local budget list.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
DO $$
DECLARE
  v_budget_id uuid:='00000000-0000-4000-8000-000000000299';
  v_header jsonb;
  v_record record;
  v_count integer;
  v_name text;
  blocked boolean:=false;
BEGIN
  v_header:=jsonb_build_object(
    'id',v_budget_id,'ref','ORC-VERSION-ATOMIC','name','First draft',
    'company_id','00000000-0000-4000-8000-000000000100',
    'assigned_to',NULL,'status','rascunho',
    'date',current_date,'valid_until',current_date+30,
    'sector','Industrial','include_tax',true,'tax_rate',23,'version',1
  );

  SELECT * INTO v_record FROM public.save_budget_atomic_versioned(v_header,'[]'::jsonb);
  IF v_record.id IS DISTINCT FROM v_budget_id OR v_record.version IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'NEW BUDGET RETURNED WRONG COMMITTED VERSION';
  END IF;

  v_header:=jsonb_set(v_header,'{name}','"Updated first time"');
  SELECT * INTO v_record FROM public.save_budget_atomic_versioned(v_header,'[]'::jsonb);
  IF v_record.id IS DISTINCT FROM v_budget_id OR v_record.version IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'FIRST UPDATE RETURNED WRONG COMMITTED VERSION';
  END IF;

  v_header:=jsonb_set(v_header,'{version}','2'::jsonb);
  v_header:=jsonb_set(v_header,'{name}','"Updated second time"');
  SELECT * INTO v_record FROM public.save_budget_atomic_versioned(v_header,'[]'::jsonb);
  IF v_record.id IS DISTINCT FROM v_budget_id OR v_record.version IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'SECOND UPDATE RETURNED WRONG COMMITTED VERSION';
  END IF;

  blocked:=false;
  BEGIN
    PERFORM public.save_budget_atomic_versioned(
      jsonb_set(v_header,'{version}','1'::jsonb),'[]'::jsonb);
  EXCEPTION WHEN SQLSTATE '40001' THEN blocked:=true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'OLD VERSION WAS ACCEPTED BY VERSIONED WRAPPER'; END IF;

  SELECT count(*),max(b.name) INTO v_count,v_name
  FROM public.budgets b WHERE b.id=v_budget_id AND b.version=3;
  IF v_count<>1 OR v_name<>'Updated second time' THEN
    RAISE EXCEPTION 'FAILED STALE WRITE CHANGED THE COMMITTED BUDGET';
  END IF;
END $$;
ROLLBACK;

SELECT 'Atomic budget save returns precise committed versions PASSED' AS result;
