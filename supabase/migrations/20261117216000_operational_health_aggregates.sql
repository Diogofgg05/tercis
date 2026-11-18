-- Operational heartbeat: aggregated counters ONLY; no customer addresses,
-- quotation content, file paths or organization IDs in alert payloads.
CREATE OR REPLACE FUNCTION public.tercis_operational_health()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_result jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Indicadores operacionais exclusivos de serviço.'
      USING ERRCODE='42501';
  END IF;
  SELECT jsonb_build_object(
    'stale_email_queue',(SELECT count(*) FROM public.quote_email_outbox
      WHERE state IN ('queued','failed') AND next_attempt_at<now()-interval '15 minutes'
        AND provider_id IS NULL),
    'stuck_email_workers',(SELECT count(*) FROM public.quote_email_outbox
      WHERE state='processing' AND updated_at<now()-interval '20 minutes'),
    'pending_attachment_scans',(SELECT count(*) FROM public.budget_attachments
      WHERE scan_status='pending' AND created_at<now()-interval '20 minutes'),
    'stuck_attachment_scans',(SELECT count(*) FROM public.budget_attachments
      WHERE scan_status='scanning' AND scan_started_at<now()-interval '15 minutes'),
    'scan_errors',(SELECT count(*) FROM public.budget_attachments
      WHERE scan_status='error' AND scanned_at>now()-interval '24 hours'),
    'malware_detected',(SELECT count(*) FROM public.budget_attachments
      WHERE scan_status='infected' AND scanned_at>now()-interval '24 hours'),
    'email_bounces',(SELECT count(*) FROM public.quote_email_outbox
      WHERE state='bounced' AND updated_at>now()-interval '24 hours'),
    'orphan_files_over_48h',(SELECT count(*) FROM
      public.tercis_list_orphan_attachment_paths(50))
  ) INTO v_result;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_operational_health()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tercis_operational_health()
  TO service_role;
