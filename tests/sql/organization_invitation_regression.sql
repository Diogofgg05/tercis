
-- Invitation regression: two tenants, one verified email, one-time redemption.
-- Requires organization_isolation_regression.sql fixture beforehand.
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('00000000-0000-4000-8000-000000000009','invitee@example.test','{}'),
 ('00000000-0000-4000-8000-000000000010','different@example.test','{}');

DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.profiles
    WHERE id='00000000-0000-4000-8000-000000000009'
      AND (active IS TRUE OR organization_id IS NOT NULL)) THEN
    RAISE EXCEPTION 'NEW SIGNUP WAS AUTOMATICALLY JOINED TO A TENANT';
  END IF;
END $$;

-- Trusted admin A issues a one-time invite. Token is returned only to A.
CREATE TEMP TABLE tercis_test_invite_token(token uuid);
GRANT SELECT ON tercis_test_invite_token TO authenticated;
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
DO $$
DECLARE token uuid;
BEGIN
  token:=public.tercis_create_organization_invite('invitee@example.test');
  PERFORM set_config('tercis.test.token',token::text,false);
END $$;
COMMIT;

-- Persist the issued token solely in the isolated test transaction environment.
INSERT INTO tercis_test_invite_token(token)
VALUES (current_setting('tercis.test.token')::uuid);

-- Different verified account cannot claim A's invitation.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000010';
DO $$
DECLARE blocked boolean:=false; token uuid;
BEGIN
  SELECT t.token INTO token FROM tercis_test_invite_token t;
  BEGIN
    PERFORM public.tercis_accept_organization_invite(token);
  EXCEPTION WHEN SQLSTATE '42501' THEN blocked:=true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'ANOTHER EMAIL ACCEPTED THE INVITATION'; END IF;
END $$;
ROLLBACK;

-- Invited user may join tenant A but stays inactive until approved.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000009';
DO $$
DECLARE token uuid; result uuid; blocked boolean:=false;
BEGIN
  SELECT t.token INTO token FROM tercis_test_invite_token t;
  result:=public.tercis_accept_organization_invite(token);
  IF result<>'00000000-0000-4000-8000-000000000900'::uuid THEN
    RAISE EXCEPTION 'INVITATION JOINED WRONG ORGANIZATION';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid()
    AND p.organization_id=result AND p.active IS FALSE) THEN
    RAISE EXCEPTION 'INVITATION INCORRECTLY ACTIVATED USER';
  END IF;
  BEGIN
    PERFORM public.tercis_accept_organization_invite(token);
  EXCEPTION WHEN SQLSTATE '42501' THEN blocked:=true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'ONE-TIME INVITATION WAS REPLAYED'; END IF;
END $$;
COMMIT;

-- After claiming, org A admin can see and approve the inactive member.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.profiles
    WHERE id='00000000-0000-4000-8000-000000000009';
  IF n<>1 THEN RAISE EXCEPTION 'INVITED PENDING USER NOT VISIBLE TO OWN ADMIN'; END IF;
  PERFORM public.tercis_admin_update_user(
    '00000000-0000-4000-8000-000000000009','collaborator',true,null
  );
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE
    id='00000000-0000-4000-8000-000000000009' AND active IS TRUE
      AND role='collaborator') THEN
    RAISE EXCEPTION 'ADMIN COULD NOT APPROVE INVITED MEMBER';
  END IF;
END $$;
ROLLBACK;

-- Tenant B admin cannot see A's pending invited profile or claims.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000007';
DO $$
DECLARE n int; blocked boolean:=false;
BEGIN
  SELECT count(*) INTO n FROM public.profiles
    WHERE id='00000000-0000-4000-8000-000000000009';
  IF n<>0 THEN RAISE EXCEPTION 'TENANT B CAN READ A INVITEE'; END IF;
  BEGIN
    PERFORM public.tercis_admin_update_user(
      '00000000-0000-4000-8000-000000000009','client',true,
      '00000000-0000-4000-8000-000000000102');
  EXCEPTION WHEN SQLSTATE '42501' THEN blocked:=true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'TENANT B CAN STEAL A INVITEE'; END IF;
END $$;
ROLLBACK;

SELECT 'Verified, one-time organization invitation acceptance PASSED' AS result;
