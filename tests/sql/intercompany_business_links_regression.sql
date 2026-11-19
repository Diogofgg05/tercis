-- Phase 28: consent-based A(client of C) and B(supplier of C).
-- Depends on the two-org fixture from organization_isolation_regression.sql.
-- All actions run on isolated CI PostgreSQL; never on production.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organizations
    WHERE id='00000000-0000-4000-8000-000000000901') THEN
    RAISE EXCEPTION 'Two-tenant fixture missing';
  END IF;
END $$;

-- The isolated PostgreSQL fixture may grant generic table rights after migrations.
-- This table must still have RLS enabled and NO permissive policy, so neither
-- tenant can enumerate or forge links through the raw PostgREST endpoint.
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class
     WHERE oid='public.tercis_business_links'::regclass) THEN
    RAISE EXCEPTION 'DIRECT LINK TABLE DOES NOT ENFORCE RLS';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='tercis_business_links') THEN
    RAISE EXCEPTION 'LINK TABLE MUST NOT HAVE A PERMISSIVE CLIENT POLICY';
  END IF;
END $$;

-- MFA cannot be skipped even when invoking SECURITY DEFINER RPC directly.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claims='{"aal":"aal1"}';
DO $$
DECLARE blocked boolean:=false;
BEGIN
  BEGIN
    PERFORM public.tercis_create_business_link_invite(
      '00000000-0000-4000-8000-000000000100','client');
  EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'AAL1 ADMIN ISSUED INTERCOMPANY INVITE'; END IF;
END $$;
ROLLBACK;

-- A admin issues a high-entropy token for a local commercial client.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
DO $$
DECLARE token uuid;
BEGIN
  token:=public.tercis_create_business_link_invite(
    '00000000-0000-4000-8000-000000000100','client');
  PERFORM set_config('tercis.test.business_token',token::text,false);
  IF (SELECT count(*) FROM public.tercis_list_business_links()
      WHERE status='pending' AND local_company_id=
        '00000000-0000-4000-8000-000000000100'::uuid)<>1 THEN
    RAISE EXCEPTION 'OWNER CANNOT SEE OWN PENDING INVITE';
  END IF;
  IF EXISTS(SELECT 1 FROM public.tercis_list_business_links()
    WHERE partner_name IS NOT NULL AND status='pending') THEN
    RAISE EXCEPTION 'PENDING INVITE EXPOSED ANOTHER TENANT';
  END IF;
END $$;
COMMIT;

-- The inviting organization cannot accept its own invitation.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
DO $$
DECLARE blocked boolean:=false;
BEGIN
  BEGIN
    PERFORM public.tercis_accept_business_link_invite(
      current_setting('tercis.test.business_token')::uuid);
  EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'SELF-ACCEPTED CROSS-COMPANY LINK'; END IF;
END $$;
ROLLBACK;

-- A customer account from B cannot redeem an organization relationship.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000008';
DO $$
DECLARE blocked boolean:=false;
BEGIN
  BEGIN
    PERFORM public.tercis_accept_business_link_invite(
      current_setting('tercis.test.business_token')::uuid);
  EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'CLIENT ACCOUNT ACCEPTED ORG LINK'; END IF;
END $$;
ROLLBACK;

-- The receiving administrator must be able to preview the proposed
-- relationship before consenting. A token reveals no private customer data.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000007';
DO $$
DECLARE details jsonb;
BEGIN
  details:=public.tercis_preview_business_link_invite(
    current_setting('tercis.test.business_token')::uuid);
  IF details->>'relationship_type'<>'client'
    OR length(coalesce(details->>'organization_name',''))<1
    OR length(coalesce(details->>'local_company_name',''))<1
    OR details ? 'private_contacts'
  THEN
    RAISE EXCEPTION 'RECEIVING ADMIN DID NOT GET A SAFE INVITE PREVIEW';
  END IF;
END $$;
ROLLBACK;

-- The B admin accepts with AAL2. Its visibility contains ONLY the approved
-- relationship and A's organization name, never A's local customer UUID.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000007';
DO $$
DECLARE v_id uuid; blocked boolean:=false;
BEGIN
  v_id:=public.tercis_accept_business_link_invite(
    current_setting('tercis.test.business_token')::uuid);
  PERFORM set_config('tercis.test.business_link_id',v_id::text,false);
  IF (SELECT count(*) FROM public.tercis_list_business_links()
    WHERE status='active' AND NOT owned_by_me
      AND local_company_id IS NULL AND local_company_name IS NULL
      AND partner_name IS NOT NULL)<>1 THEN
    RAISE EXCEPTION 'B RECIPIENT VIEW LEAKED A LOCAL CUSTOMER DETAILS'; END IF;
  IF EXISTS (SELECT 1 FROM public.budgets b
      WHERE b.company_id='00000000-0000-4000-8000-000000000100') THEN
    RAISE EXCEPTION 'COMMERCIAL LINK EXPOSED A PRIVATE QUOTE TO B'; END IF;
  IF EXISTS (SELECT 1 FROM public.companies c
      WHERE c.id='00000000-0000-4000-8000-000000000100') THEN
    RAISE EXCEPTION 'COMMERCIAL LINK EXPOSED A PRIVATE COMPANY ROW TO B'; END IF;
  BEGIN
    PERFORM public.tercis_accept_business_link_invite(
      current_setting('tercis.test.business_token')::uuid);
  EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'SINGLE-USE PARTNER INVITE WAS REPLAYED'; END IF;
END $$;
COMMIT;

-- A now knows ONLY that B's business identity accepted the link.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
DO $$
DECLARE blocked boolean:=false;
BEGIN
  IF (SELECT count(*) FROM public.tercis_list_business_links()
    WHERE status='active' AND owned_by_me
      AND partner_name='Tenant B')<>1 THEN
    RAISE EXCEPTION 'OWNER DID NOT RECEIVE ACCEPTED PARTNER'; END IF;
  -- A must not turn B's local client record into an owned client.
  BEGIN
    PERFORM public.tercis_create_business_link_invite(
      '00000000-0000-4000-8000-000000000102','supplier');
  EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'A ISSUED INVITE FOR B CUSTOMER RECORD'; END IF;
  IF EXISTS(SELECT 1 FROM public.custom_catalog_items
    WHERE description='Only tenant B supplier price') THEN
    RAISE EXCEPTION 'BUSINESS LINK EXPOSED B SUPPLIER CATALOG'; END IF;
END $$;
ROLLBACK;

-- The recipient may revoke an active link; no user or quote is deleted.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000007';
DO $$
BEGIN
  IF NOT public.tercis_revoke_business_link(
      current_setting('tercis.test.business_link_id')::uuid) THEN
    RAISE EXCEPTION 'RECIPIENT FAILED TO REVOKE PARTNERSHIP'; END IF;
  IF EXISTS (SELECT 1 FROM public.tercis_list_business_links()
      WHERE status='active') THEN
    RAISE EXCEPTION 'REVOKED PARTNERSHIP REMAINS ACTIVE'; END IF;
END $$;
COMMIT;

SELECT 'Consent-based cross-organization relationship and privacy regression PASSED' AS result;
