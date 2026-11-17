-- Delegated admin is tenant-scoped, restricted by role and verified MFA.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000005';
SET LOCAL request.jwt.claims='{"aal":"aal2"}';
DO $$
DECLARE invite uuid; changed_role text; changed_active boolean; blocked boolean;
BEGIN
  invite:=public.tercis_create_organization_invite('new-member@example.test');
  IF invite IS NULL THEN
    RAISE EXCEPTION 'TENANT ADMIN COULD NOT CREATE OWN TENANT INVITATION';
  END IF;

  PERFORM public.tercis_admin_update_user(
    '00000000-0000-4000-8000-000000000002','collaborator',true,null);
  SELECT role,active INTO changed_role,changed_active
  FROM public.profiles WHERE id='00000000-0000-4000-8000-000000000002';
  IF changed_role<>'collaborator' OR changed_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'TENANT ADMIN COULD NOT APPROVE ORDINARY COLLABORATOR';
  END IF;

  blocked:=false;
  BEGIN
    PERFORM public.tercis_admin_update_user(
      '00000000-0000-4000-8000-000000000002','company_admin',true,
      '00000000-0000-4000-8000-000000000100');
  EXCEPTION WHEN SQLSTATE '42501' THEN blocked:=true;
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION 'TENANT ADMIN PROMOTED OTHER USER TO AN ADMIN';
  END IF;

  blocked:=false;
  BEGIN
    PERFORM public.tercis_admin_update_user(
      '00000000-0000-4000-8000-000000000001','client',false,null);
  EXCEPTION WHEN SQLSTATE '42501' THEN blocked:=true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'TENANT ADMIN MODIFIED LEGACY ADMIN'; END IF;

  blocked:=false;
  BEGIN
    PERFORM public.tercis_admin_update_user(
      '00000000-0000-4000-8000-000000000008','collaborator',true,null);
  EXCEPTION WHEN SQLSTATE '42501' THEN blocked:=true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'TENANT ADMIN MODIFIED OTHER TENANT'; END IF;

  blocked:=false;
  BEGIN
    PERFORM public.tercis_admin_update_user(
      '00000000-0000-4000-8000-000000000005','client',false,null);
  EXCEPTION WHEN SQLSTATE '42501' THEN blocked:=true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'TENANT ADMIN CHANGED OWN ROLE'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000005';
SET LOCAL request.jwt.claims='{"aal":"aal1"}';
DO $$
DECLARE blocked boolean:=false;
BEGIN
  BEGIN
    PERFORM public.tercis_create_organization_invite('no-mfa@example.test');
  EXCEPTION WHEN SQLSTATE '42501' THEN blocked:=true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'AAL1 TENANT ADMIN ISSUED INVITE'; END IF;
  blocked:=false;
  BEGIN
    PERFORM public.tercis_admin_update_user(
      '00000000-0000-4000-8000-000000000002','collaborator',true,null);
  EXCEPTION WHEN SQLSTATE '42501' THEN blocked:=true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'AAL1 TENANT ADMIN APPROVED ACCOUNT'; END IF;
END $$;
ROLLBACK;

SELECT 'Tenant administrator delegated onboarding and MFA checks PASSED' AS result;
