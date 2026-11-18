-- Customer-directory isolation, budget creation and immutable associations.
-- Runs only against the disposable PostgreSQL fixture.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000003';
DO $$
DECLARE
  n integer;
  forbidden boolean := false;
BEGIN
  -- Worker has not been assigned a customer budget: company directory must be empty.
  SELECT count(*) INTO n FROM public.companies;
  IF n <> 0 THEN RAISE EXCEPTION 'COLLABORATOR READ UNASSIGNED CUSTOMERS: %', n; END IF;

  -- Worker must not be allowed to construct a quote for an arbitrary customer.
  BEGIN
    INSERT INTO public.budgets (id,ref,name,company_id,created_by)
    VALUES ('00000000-0000-4000-8000-000000000210','ORC-SCOPE-DENIED','Forged scope',
      '00000000-0000-4000-8000-000000000101',
      '00000000-0000-4000-8000-000000000003');
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN forbidden:=true;
  END;
  IF NOT forbidden THEN RAISE EXCEPTION 'COLLABORATOR CREATED QUOTE FOR ARBITRARY CUSTOMER'; END IF;

  -- Worker may begin a new unassigned draft for their own work.
  INSERT INTO public.budgets(id,ref,name,company_id,created_by,assigned_to)
  VALUES('00000000-0000-4000-8000-000000000211','ORC-SCOPE-DRAFT','Unassigned draft',NULL,
    '00000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000003');
  SELECT count(*) INTO n FROM public.budgets
  WHERE id='00000000-0000-4000-8000-000000000211';
  IF n <> 1 THEN RAISE EXCEPTION 'WORKER CANNOT CREATE OWN UNASSIGNED DRAFT'; END IF;
END $$;
ROLLBACK;

-- Admin can assign a customer to a draft and worker gets scoped access.
INSERT INTO public.budgets(id,ref,name,company_id,created_by,assigned_to)
VALUES('00000000-0000-4000-8000-000000000212','ORC-SCOPE-ASSIGNED','Assigned budget',
       '00000000-0000-4000-8000-000000000100',
       '00000000-0000-4000-8000-000000000001',
       '00000000-0000-4000-8000-000000000003');

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000003';
DO $$
DECLARE
  n integer;
  forbidden boolean:=false;
BEGIN
  SELECT count(*) INTO n FROM public.companies;
  IF n <> 1 THEN RAISE EXCEPTION 'ASSIGNED WORKER CUSTOMER SCOPE INCORRECT: %',n; END IF;

  -- The worker cannot silently change the customer of their assigned budget.
  BEGIN
    UPDATE public.budgets SET company_id='00000000-0000-4000-8000-000000000101'
    WHERE id='00000000-0000-4000-8000-000000000212';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN forbidden:=true;
  END;
  -- RLS may simply not permit UPDATE (zero rows), which is also correct.
  IF NOT forbidden THEN
    SELECT count(*) INTO n FROM public.budgets
    WHERE id='00000000-0000-4000-8000-000000000212'
      AND company_id='00000000-0000-4000-8000-000000000101';
    IF n <> 0 THEN RAISE EXCEPTION 'WORKER REASSIGNED CUSTOMER WITHOUT APPROVAL'; END IF;
  END IF;
END $$;
ROLLBACK;

-- Client only sees their own company record; not other customer contacts.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000004';
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.companies;
  IF n <> 1 THEN RAISE EXCEPTION 'CLIENT COMPANY DIRECTORY EXPOSURE: %',n; END IF;
END $$;
ROLLBACK;

SELECT 'Customer company read and quote assignment guard PASSED' AS result;
