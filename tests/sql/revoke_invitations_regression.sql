-- Revocation must invalidate an otherwise unused invitation without
-- disclosing its bearer-token ID to another organization.
INSERT INTO auth.users(id,email,raw_user_meta_data)
VALUES('00000000-0000-4000-8000-000000000029','revoke-me@example.test','{}');

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claims='{"aal":"aal2"}';
DO $$
DECLARE token uuid; removed integer; again integer;
BEGIN
  token:=public.tercis_create_organization_invite('revoke-me@example.test');
  removed:=public.tercis_revoke_organization_invites('revoke-me@example.test');
  again:=public.tercis_revoke_organization_invites('revoke-me@example.test');
  IF removed<>1 OR again<>0 THEN
    RAISE EXCEPTION 'REVOCATION NOT IDEMPOTENT';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.organization_invites
    WHERE id=token AND revoked_at IS NOT NULL AND used_at IS NULL)
  THEN RAISE EXCEPTION 'INVITE WAS NOT REVOKED'; END IF;
  PERFORM set_config('tercis.test.revoked_token',token::text,true);
END $$;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000029';
DO $$
DECLARE blocked boolean:=false;
BEGIN
  BEGIN
    PERFORM public.tercis_accept_organization_invite(
      current_setting('tercis.test.revoked_token')::uuid);
  EXCEPTION WHEN SQLSTATE '42501' THEN blocked:=true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'REVOKED INVITE WAS ACCEPTED'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';
DO $$
DECLARE denied boolean:=false;
BEGIN
  BEGIN
    PERFORM public.tercis_revoke_organization_invites('revoke-me@example.test');
  EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'CLIENT REVOKED INVITATIONS'; END IF;
END $$;
ROLLBACK;
SELECT 'Organization invitations may be revoked only by AAL2 admins PASSED' AS result;
