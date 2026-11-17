-- A real transaction test: writes, stale versions and invalid line rollback.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
DO $$
DECLARE
  v_id uuid := '00000000-0000-4000-8000-000000000200';
  v_company uuid := '00000000-0000-4000-8000-000000000100';
  v_header jsonb;
  v_items jsonb;
  v_count integer;
  v_version integer;
  v_name text;
  v_denied boolean;
BEGIN
  v_header := jsonb_build_object(
    'id',v_id,'ref','ORC-TEST-001','name','Primeira gravação segura',
    'company_id',v_company,'assigned_to',NULL,'status','rascunho',
    'sector','Automação','date',current_date,'valid_until',current_date+30,
    'notes','','client_contact','','client_email','','include_tax',false,
    'tax_rate',23,'version',1
  );
  v_items := jsonb_build_array(jsonb_build_object(
    'id','00000000-0000-4000-8000-000000000300',
    'code','TEST-1','description','Proteção', 'quantity',2,
    'unit_cost',12.50,'margin',20,'discount',0
  ));

  PERFORM public.save_budget_atomic(v_header,v_items);
  SELECT version,name INTO v_version,v_name FROM public.budgets WHERE id=v_id;
  SELECT count(*) INTO v_count FROM public.budget_items WHERE budget_id=v_id;
  IF v_version <> 2 OR v_count <> 1 OR v_name <> 'Primeira gravação segura' THEN
    RAISE EXCEPTION 'ATOMIC SAVE DID NOT UPDATE HEADER AND ITEMS';
  END IF;

  -- A stale browser cannot silently replace the current contents.
  v_denied := false;
  BEGIN
    PERFORM public.save_budget_atomic(
      jsonb_set(v_header,'{name}','"ESCRITA ANTIGA"'),v_items
    );
  EXCEPTION WHEN SQLSTATE '40001' THEN v_denied:=true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'STALE VERSION WAS ACCEPTED'; END IF;
  SELECT version,name INTO v_version,v_name FROM public.budgets WHERE id=v_id;
  IF v_version <> 2 OR v_name <> 'Primeira gravação segura' THEN
    RAISE EXCEPTION 'STALE WRITE CHANGED DATA';
  END IF;

  -- An invalid child causes the whole transaction (including header) to roll back.
  v_denied := false;
  BEGIN
    PERFORM public.save_budget_atomic(
      jsonb_set(jsonb_set(v_header,'{version}','2'),' {name}'::text[],'"INVALIDO"'),
      jsonb_build_array(jsonb_build_object(
        'code','INVALID','quantity',-3,'unit_cost',99,'margin',0,'discount',0
      ))
    );
  EXCEPTION WHEN SQLSTATE '22023' THEN v_denied:=true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'INVALID CHILD WAS ACCEPTED'; END IF;
  SELECT version,name INTO v_version,v_name FROM public.budgets WHERE id=v_id;
  SELECT count(*) INTO v_count FROM public.budget_items WHERE budget_id=v_id;
  IF v_version <> 2 OR v_count <> 1 OR v_name <> 'Primeira gravação segura' THEN
    RAISE EXCEPTION 'FAILED CHILD WRITE LOST EXISTING DATA';
  END IF;

  -- A subsequent valid save can remove all items atomically.
  PERFORM public.save_budget_atomic(jsonb_set(v_header,'{version}','2'), '[]'::jsonb);
  SELECT version INTO v_version FROM public.budgets WHERE id=v_id;
  SELECT count(*) INTO v_count FROM public.budget_items WHERE budget_id=v_id;
  IF v_version <> 3 OR v_count <> 0 THEN
    RAISE EXCEPTION 'EMPTY ITEM REPLACEMENT FAILED';
  END IF;
END $$;
ROLLBACK;

SELECT 'Atomic budget/version tests PASSED' AS result;
