-- Validate actual SQL EXECUTE privileges, not just frontend role checks.
-- These are sensitive operations that must never be callable by anon users.
DO $$
DECLARE v_leaks text;
BEGIN
  SELECT string_agg(p.oid::regprocedure::text,', ' ORDER BY p.proname)
  INTO v_leaks
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND p.proname IN (
      'tercis_import_catalog_batch','tercis_catalog_price_history',
      'tercis_report_summary','tercis_send_internal_budget_message',
      'tercis_revoke_organization_invites','tercis_create_organization_invite',
      'tercis_accept_organization_invite','tercis_queue_quote_email',
      'tercis_claim_quote_email_jobs','tercis_complete_attachment_scan',
      'tercis_claim_attachment_scans','tercis_claim_attachment_scans_v2',
      'tercis_complete_attachment_scan_v2','tercis_operational_health',
      'tercis_register_quote_email_provider','tercis_record_quote_email_event',
      'tercis_apply_email_delivery_event','tercis_list_orphan_attachment_paths'
    )
    AND has_function_privilege('anon',p.oid,'EXECUTE');
  IF v_leaks IS NOT NULL THEN
    RAISE EXCEPTION 'ANONYMOUS EXECUTE ON PRIVILEGED RPC: %',v_leaks;
  END IF;
END $$;

DO $$
DECLARE v_leaks text;
BEGIN
  SELECT string_agg(p.oid::regprocedure::text,', ')
  INTO v_leaks
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND p.proname IN (
      'tercis_claim_quote_email_jobs','tercis_complete_attachment_scan',
      'tercis_claim_attachment_scans','tercis_claim_attachment_scans_v2',
      'tercis_complete_attachment_scan_v2','tercis_operational_health',
      'tercis_register_quote_email_provider','tercis_record_quote_email_event',
      'tercis_apply_email_delivery_event','tercis_list_orphan_attachment_paths'
    )
    AND has_function_privilege('authenticated',p.oid,'EXECUTE');
  IF v_leaks IS NOT NULL THEN
    RAISE EXCEPTION 'AUTHENTICATED USER CAN CALL SERVICE-ONLY RPC: %',v_leaks;
  END IF;
END $$;

DO $$
DECLARE name text; id oid;
BEGIN
  FOREACH name IN ARRAY ARRAY[
    'tercis_report_summary(integer,text,uuid)',
    'tercis_send_internal_budget_message(uuid,text)',
    'tercis_revoke_organization_invites(text)',
    'tercis_import_catalog_batch(jsonb)',
    'tercis_catalog_price_history(uuid)'
  ] LOOP
    id:=to_regprocedure('public.'||name);
    IF id IS NULL OR NOT has_function_privilege('authenticated',id,'EXECUTE') THEN
      RAISE EXCEPTION 'MISSING AUTHENTICATED RPC CONTRACT: %',name;
    END IF;
  END LOOP;
END $$;
SELECT 'Privileged RPCs enforce narrow SQL EXECUTE contracts PASSED' AS result;
