-- Regression coverage: sent documents never disappear, submission is
-- complete, expired offers cannot be accepted, and revisions are immutable.

-- Use the seeded sent quote from the workflow smoke test.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
DO $$
DECLARE v record; changed integer; originals jsonb;
BEGIN
  SELECT snapshot INTO originals FROM public.budget_versions
   WHERE budget_id='00000000-0000-4000-8000-000000000200' AND version=4;
  IF originals IS NULL OR originals->>'snapshot_kind'<>'sent_quote' OR
     jsonb_array_length(originals->'items')<1 OR
     originals->'budget'->>'status'<>'enviado' THEN
    RAISE EXCEPTION 'NO IMMUTABLE SENT-QUOTE SNAPSHOT';
  END IF;

  SELECT * INTO v FROM public.tercis_transition_budget(
    '00000000-0000-4000-8000-000000000200','rejeitado',4);
  SELECT * INTO v FROM public.tercis_transition_budget(
    '00000000-0000-4000-8000-000000000200','rascunho',5);

  DELETE FROM public.budgets
   WHERE id='00000000-0000-4000-8000-000000000200';
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>0 THEN RAISE EXCEPTION 'A PREVIOUSLY SENT QUOTE WAS DELETED'; END IF;

  UPDATE public.budgets SET name='Revised commercial terms'
   WHERE id='00000000-0000-4000-8000-000000000200';
  SELECT snapshot INTO v FROM public.budget_versions
   WHERE budget_id='00000000-0000-4000-8000-000000000200' AND version=4;
  IF v.snapshot IS DISTINCT FROM originals THEN
    RAISE EXCEPTION 'A REVISION OVERWROTE THE PREVIOUS SENT SNAPSHOT';
  END IF;

  UPDATE public.budget_versions SET snapshot='{}'::jsonb
   WHERE budget_id='00000000-0000-4000-8000-000000000200';
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>0 THEN RAISE EXCEPTION 'SENT SNAPSHOT WAS MUTABLE BY CLIENT API'; END IF;
END $$;
ROLLBACK;

-- Customers may never query internal snapshots and purchase costs.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';
DO $$
DECLARE visible integer;
BEGIN
  SELECT count(*) INTO visible FROM public.budget_versions;
  IF visible<>0 THEN RAISE EXCEPTION 'CUSTOMER EXPOSED TO PRIVATE VERSION SNAPSHOTS'; END IF;
END $$;
ROLLBACK;

-- An authorized user can create an incomplete draft but cannot submit it.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
DO $$
DECLARE v uuid:='00000000-0000-4000-8000-000000000294'; blocked boolean:=false;
BEGIN
  INSERT INTO public.budgets(id,ref,name,created_by,company_id,status)
   VALUES(v,'ORC-EMPTY-SUBMIT','Must have item',
     '00000000-0000-4000-8000-000000000001',
     '00000000-0000-4000-8000-000000000100','rascunho');
  BEGIN
    PERFORM public.tercis_transition_budget(v,'pendente_aprovacao',1);
  EXCEPTION WHEN SQLSTATE '22023' THEN blocked:=true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'EMPTY QUOTE WAS SUBMITTED'; END IF;

  INSERT INTO public.budget_items(budget_id,description,quantity,unit_cost,margin,discount)
   VALUES(v,'',1,10,20,0);
  blocked:=false;
  BEGIN
    PERFORM public.tercis_transition_budget(v,'pendente_aprovacao',1);
  EXCEPTION WHEN SQLSTATE '22023' THEN blocked:=true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'QUOTE WITH EMPTY LINE DESCRIPTION WAS SUBMITTED'; END IF;

  UPDATE public.budget_items SET description='Service' WHERE budget_id=v;
  PERFORM public.tercis_transition_budget(v,'pendente_aprovacao',1);
END $$;
ROLLBACK;

-- An already-sent quote whose validity has passed cannot be accepted.
INSERT INTO public.budgets(id,ref,name,created_by,company_id,status,
                           sent_at,version,date,valid_until)
VALUES('00000000-0000-4000-8000-000000000295','ORC-EXPIRED-PUBLISHED',
       'Historical expired quote',
       '00000000-0000-4000-8000-000000000001',
       '00000000-0000-4000-8000-000000000100',
       'enviado',now(),4,current_date-40,current_date-1);

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';
DO $$
DECLARE blocked boolean:=false;
BEGIN
  BEGIN
    PERFORM public.tercis_transition_budget(
      '00000000-0000-4000-8000-000000000295','aceite',4);
  EXCEPTION WHEN SQLSTATE '22023' THEN blocked:=true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'EXPIRED CLIENT QUOTE WAS ACCEPTED'; END IF;
END $$;
ROLLBACK;

-- Two organizations may independently use the same quote reference.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000007';
DO $$
DECLARE n integer;
BEGIN
  INSERT INTO public.budgets(id,ref,name,created_by,company_id,status)
  VALUES('00000000-0000-4000-8000-000000000296','ORC-TEST-001',
         'Same ref, different tenant',
         '00000000-0000-4000-8000-000000000007',
         '00000000-0000-4000-8000-000000000102','rascunho');
  SELECT count(*) INTO n FROM public.budgets WHERE ref='ORC-TEST-001';
  IF n<>1 THEN RAISE EXCEPTION 'CROSS-TENANT REFERENCE IS NOT SCOPED'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
DO $$
DECLARE blocked boolean:=false;
BEGIN
  BEGIN
    INSERT INTO public.budgets(id,ref,name,created_by,company_id,status)
    VALUES('00000000-0000-4000-8000-000000000297','ORC-TEST-001',
           'Duplicate in same organization',
           '00000000-0000-4000-8000-000000000001',
           '00000000-0000-4000-8000-000000000100','rascunho');
  EXCEPTION WHEN unique_violation THEN blocked:=true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'DUPLICATE REFERENCE ALLOWED IN TENANT'; END IF;
END $$;
ROLLBACK;

SELECT 'Tercis commercial integrity, immutable snapshots and tenant refs PASSED' AS result;
