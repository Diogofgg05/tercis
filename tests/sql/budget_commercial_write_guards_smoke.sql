-- Commercial integrity checks after a quote is submitted or sent.
-- All fixtures live in the CI PostgreSQL database, not in Supabase production.
INSERT INTO public.budgets(id,ref,name,company_id,created_by,status,version)
VALUES('00000000-0000-4000-8000-000000000230','ORC-LOCKED-001',
       'Quoted project - locked','00000000-0000-4000-8000-000000000100',
       '00000000-0000-4000-8000-000000000001','enviado',1);
INSERT INTO public.budget_items(id,budget_id,code,description,quantity,unit_cost,margin,discount)
VALUES('00000000-0000-4000-8000-000000000330',
       '00000000-0000-4000-8000-000000000230',
       'LOCKED-1','Quoted item',1,100,20,0);

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
DO $$
DECLARE
  denied boolean;
  changes int;
BEGIN
  denied:=false;
  BEGIN
    UPDATE public.budgets SET name='Illicit commercial change'
      WHERE id='00000000-0000-4000-8000-000000000230';
  EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'SENT QUOTE COMMERCIAL FIELDS WERE EDITABLE'; END IF;

  denied:=false;
  BEGIN
    INSERT INTO public.budget_items(budget_id,code,quantity,unit_cost)
    VALUES('00000000-0000-4000-8000-000000000230','FORGED-ITEM',1,42);
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'SENT QUOTE ACCEPTED NEW PRICE LINES'; END IF;

  UPDATE public.budget_items SET unit_cost=1
    WHERE id='00000000-0000-4000-8000-000000000330';
  GET DIAGNOSTICS changes=ROW_COUNT;
  IF changes<>0 THEN RAISE EXCEPTION 'SENT QUOTE COST WAS CHANGED'; END IF;

  DELETE FROM public.budget_items
    WHERE id='00000000-0000-4000-8000-000000000330';
  GET DIAGNOSTICS changes=ROW_COUNT;
  IF changes<>0 THEN RAISE EXCEPTION 'SENT QUOTE ITEM WAS REMOVED'; END IF;

  DELETE FROM public.budgets
    WHERE id='00000000-0000-4000-8000-000000000230';
  GET DIAGNOSTICS changes=ROW_COUNT;
  IF changes<>0 THEN RAISE EXCEPTION 'SENT QUOTE WAS DELETED'; END IF;
END $$;
ROLLBACK;

-- Rascunho continues to be editable and deletable by an authorised admin.
INSERT INTO public.budgets(id,ref,name,company_id,created_by,status,version)
VALUES('00000000-0000-4000-8000-000000000231','ORC-EDITABLE-001',
       'Editable draft',NULL,'00000000-0000-4000-8000-000000000001',
       'rascunho',1);

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
DO $$
DECLARE changes int;
BEGIN
  UPDATE public.budgets SET name='Editable draft (updated)'
  WHERE id='00000000-0000-4000-8000-000000000231';
  GET DIAGNOSTICS changes=ROW_COUNT;
  IF changes<>1 THEN RAISE EXCEPTION 'DRAFT EDIT REGRESSION'; END IF;

  DELETE FROM public.budgets
  WHERE id='00000000-0000-4000-8000-000000000231';
  GET DIAGNOSTICS changes=ROW_COUNT;
  IF changes<>1 THEN RAISE EXCEPTION 'DRAFT DELETE REGRESSION'; END IF;
END $$;
ROLLBACK;
SELECT 'Commercial quote editing and deletion guards PASSED' AS result;
