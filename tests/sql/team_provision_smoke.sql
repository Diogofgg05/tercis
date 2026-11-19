-- Protected team provisioning in disposable PostgreSQL, with real auth.uid.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000003';
DO $$
DECLARE denied boolean:=false;
BEGIN
  BEGIN
    PERFORM public.tercis_admin_update_user(
      '00000000-0000-4000-8000-000000000002','collaborator',true,null);
  EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'COLLABORATOR APPROVED AN ACCOUNT'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
DO $$
DECLARE denied boolean:=false;
DECLARE v_role text;
DECLARE v_active boolean;
DECLARE v_company_id uuid;
DECLARE v_audits integer;
BEGIN
  BEGIN
    PERFORM public.tercis_admin_update_user(
      '00000000-0000-4000-8000-000000000001','client',false,null);
  EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'ADMIN MODIFIED THEIR OWN ROLE'; END IF;

  PERFORM public.tercis_admin_update_user(
    '00000000-0000-4000-8000-000000000002','client',true,
    '00000000-0000-4000-8000-000000000100'
  );
  SELECT role,active,company_id INTO v_role,v_active,v_company_id
  FROM public.profiles WHERE id='00000000-0000-4000-8000-000000000002';
  IF v_role <> 'client' OR NOT v_active OR v_company_id <> '00000000-0000-4000-8000-000000000100'::uuid
    THEN RAISE EXCEPTION 'ACCOUNT APPROVAL DID NOT UPDATE THE TARGET PROFILE'; END IF;
  SELECT count(*) INTO v_audits FROM public.audit_logs WHERE
    entity_id = '00000000-0000-4000-8000-000000000002'::uuid
    AND action='team_account_updated';
  IF v_audits <> 1 THEN RAISE EXCEPTION 'AUDIT RECORD MISSING'; END IF;
END $$;
ROLLBACK;

SELECT 'Team role and activation tests PASSED' AS result;
