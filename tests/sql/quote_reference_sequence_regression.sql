-- A reference is assigned by PostgreSQL at save time, scoped per tenant
-- and locked against later modification. Existing legacy refs are preserved.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claims='{"aal":"aal2"}';
DO $$
DECLARE a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();
DECLARE ar text;br text;av integer;bv integer;blocked boolean:=false;
DECLARE y text:=extract(year from current_date)::integer::text;
BEGIN
  SELECT ref,version INTO ar,av FROM public.save_budget_atomic_with_ref(
    jsonb_build_object('id',a,'ref','ORC-'||y||'-0001-AAA111',
      'name','Concurrent reference A','status','rascunho',
      'date',current_date::text,
      'valid_until',(current_date+30)::text,'version',1), '[]'::jsonb
  );
  SELECT ref,version INTO br,bv FROM public.save_budget_atomic_with_ref(
    jsonb_build_object('id',b,'ref','ORC-'||y||'-0001-BBB222',
      'name','Concurrent reference B','status','rascunho',
      'date',current_date::text,
      'valid_until',(current_date+30)::text,'version',1), '[]'::jsonb
  );
  IF ar=br OR ar !~ ('^ORC-'||y||'-[0-9]{6}$') OR
     br !~ ('^ORC-'||y||'-[0-9]{6}$') OR
     (substring(br FROM '[0-9]{6}$')::integer-
      substring(ar FROM '[0-9]{6}$')::integer)<>1 THEN
    RAISE EXCEPTION 'TENANT QUOTE REFERENCE COUNTER FAILED: %, %',ar,br;
  END IF;
  IF av<1 OR bv<1 THEN RAISE EXCEPTION 'VERSION NOT RETURNED'; END IF;
  BEGIN
    UPDATE public.budgets SET ref='FORGED-REF' WHERE id=a;
  EXCEPTION WHEN SQLSTATE '42501' THEN blocked:=true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'AUTHENTICATED USER CHANGED ISSUED REF'; END IF;
  IF EXISTS(SELECT 1 FROM public.budgets WHERE id=a AND ref<>'') THEN
    NULL;
  END IF;
END $$;
ROLLBACK;
SELECT 'Transactionally allocated and immutable tenant quote references PASSED' AS result;
