
-- Backend MFA regression using JWT AAL1/AAL2 and actual PostgreSQL RLS.
-- A privileged account with only password authentication must not read
-- commercial data or call SECURITY DEFINER administrative operations.

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claims='{"aal":"aal1"}';
DO $$
DECLARE n integer; denied boolean; allowed boolean;
BEGIN
  SELECT count(*) INTO n FROM public.profiles;
  IF n<>1 THEN RAISE EXCEPTION 'AAL1 ADMIN CAN READ OTHER USERS: %',n; END IF;
  SELECT count(*) INTO n FROM public.budgets;
  IF n<>0 THEN RAISE EXCEPTION 'AAL1 ADMIN BYPASSED RLS ON BUDGETS'; END IF;
  SELECT count(*) INTO n FROM public.companies;
  IF n<>0 THEN RAISE EXCEPTION 'AAL1 ADMIN BYPASSED RLS ON CUSTOMERS'; END IF;
  SELECT count(*) INTO n FROM public.custom_catalog_items;
  IF n<>0 THEN RAISE EXCEPTION 'AAL1 ADMIN BYPASSED SUPPLIER COST PRIVACY'; END IF;

  denied:=false;
  BEGIN
    PERFORM public.tercis_create_organization_invite('unauthorized@example.test');
  EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'AAL1 ADMIN CREATED TENANT INVITATION'; END IF;

  denied:=false;
  BEGIN
    PERFORM public.tercis_admin_update_user(
      '00000000-0000-4000-8000-000000000003','collaborator',true,null);
  EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'AAL1 ADMIN MANAGED TEAM PROFILES'; END IF;

  IF public.tercis_budget_can_move('rascunho','pendente_aprovacao',auth.uid()) THEN
    RAISE EXCEPTION 'AAL1 ADMIN BYPASSED MFA WHEN SUBMITTING A QUOTE';
  END IF;
  IF public.tercis_budget_can_move('enviado','rejeitado',auth.uid()) THEN
    RAISE EXCEPTION 'AAL1 ADMIN AUTHORIZED APPROVAL/REJECTION';
  END IF;

  denied:=false;
  BEGIN
    PERFORM public.tercis_transition_budget(
      '00000000-0000-4000-8000-000000000200','rejeitado',4);
  EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'AAL1 ADMIN TRANSITIONED SENT QUOTE'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000007';
SET LOCAL request.jwt.claims='{"aal":"aal1"}';
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.budgets;
  IF n<>0 THEN RAISE EXCEPTION 'TENANT B COMPANY ADMIN AAL1 READ QUOTES'; END IF;
  SELECT count(*) INTO n FROM public.company_settings;
  IF n<>0 THEN RAISE EXCEPTION 'TENANT B COMPANY ADMIN AAL1 READ SETTINGS'; END IF;
END $$;
ROLLBACK;

-- Customers do not need TOTP to read their own already-published redacted feed.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000008';
SET LOCAL request.jwt.claims='{"aal":"aal1"}';
DO $$
DECLARE quotes jsonb;
BEGIN
  SELECT public.tercis_client_quote_feed() INTO quotes;
  IF jsonb_array_length(quotes)<>1 OR quotes::text NOT LIKE '%B-2026-001%' THEN
    RAISE EXCEPTION 'CUSTOMER AT AAL1 LOST AUTHORIZED QUOTE FEED';
  END IF;
END $$;
ROLLBACK;

-- The exact same admin JWT with AAL2 must retain scoped access.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000007';
SET LOCAL request.jwt.claims='{"aal":"aal2"}';
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.budgets;
  IF n<>1 THEN RAISE EXCEPTION 'AAL2 ADMIN LOST OWN QUOTE'; END IF;
  SELECT count(*) INTO n FROM public.companies;
  IF n<>1 THEN RAISE EXCEPTION 'AAL2 ADMIN LOST OWN CUSTOMERS'; END IF;
  IF NOT public.tercis_budget_can_move('rascunho','pendente_aprovacao',auth.uid()) THEN
    RAISE EXCEPTION 'AAL2 ADMIN CANNOT SUBMIT A VALID QUOTE';
  END IF;
  IF NOT public.tercis_budget_can_move('enviado','rejeitado',auth.uid()) THEN
    RAISE EXCEPTION 'AAL2 ADMIN CAN NO LONGER AUTHORIZE A VALID REJECTION';
  END IF;
END $$;
ROLLBACK;

SELECT 'Verified TOTP AAL2 enforcement in RLS and privileged RPCs PASSED' AS result;
