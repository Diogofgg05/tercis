-- Phase 20: fail-closed storage and antivirus race protection.
--
-- Previously, an uploader was permitted to delete a scanned object at its
-- original path, then upload different bytes to the SAME path. The immutable
-- metadata record could still say 'clean', exposing unscanned bytes.
-- A trusted service-role maintenance process is the ONLY safe deletion path:
-- it must reconcile metadata and object removal before reusing any path.
DROP POLICY IF EXISTS "Tercis private attachments staff delete" ON storage.objects;
DROP POLICY IF EXISTS "Tercis private attachments immutable" ON storage.objects;
CREATE POLICY "Tercis private attachments immutable"
  ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
  USING (bucket_id <> 'tercis-private-attachments');

-- Upsert/overwrite remains denied: no UPDATE policy for authenticated users.
-- Supabase Storage may require SELECT as well as DELETE to remove an object.
-- The restrictive rule above rejects DELETE even when the object is visible.
-- Ordinary app uploads always use randomized, immutable paths.

-- Each worker gets a monotonic scan_attempts token. A stale worker must not
-- be able to approve a newer attempt's result after a timeout/re-claim.
CREATE OR REPLACE FUNCTION public.tercis_claim_attachment_scans_v2(
  p_limit integer DEFAULT 10
) RETURNS TABLE(
  id uuid,file_path text,mime_type text,size_bytes bigint,attempt_count integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $claim_v2$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Only the scanner service may claim attachments.'
      USING ERRCODE='42501';
  END IF;
  RETURN QUERY
  WITH picked AS (
    SELECT a.id FROM public.budget_attachments a
    WHERE (
      a.scan_status='pending'
      OR (a.scan_status='scanning'
        AND a.scan_started_at < now()-interval '15 minutes')
      OR (a.scan_status='error'
        AND a.scanned_at < now()-interval '10 minutes')
    )
      AND a.scan_attempts < 3
    ORDER BY a.created_at,a.id
    FOR UPDATE SKIP LOCKED
    LIMIT greatest(1,least(coalesce(p_limit,10),50))
  ), updated AS (
    UPDATE public.budget_attachments a SET
      scan_status='scanning',
      scan_attempts=a.scan_attempts+1,
      scan_started_at=now(),
      scanned_at=NULL,scan_engine=NULL,scan_result=NULL
    FROM picked p WHERE p.id=a.id
    RETURNING a.id,a.file_path,a.mime_type,a.size_bytes,a.scan_attempts
  )
  SELECT u.id,u.file_path,u.mime_type,u.size_bytes,u.scan_attempts FROM updated u;
END;
$claim_v2$;
REVOKE ALL ON FUNCTION public.tercis_claim_attachment_scans_v2(integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tercis_claim_attachment_scans_v2(integer)
  TO service_role;

CREATE OR REPLACE FUNCTION public.tercis_complete_attachment_scan_v2(
  p_id uuid,p_attempt_count integer,p_result text,p_detail text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $complete_v2$
DECLARE v_id uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Only the scanner service may approve attachments.'
      USING ERRCODE='42501';
  END IF;
  IF p_attempt_count IS NULL OR p_attempt_count<1 OR p_attempt_count>10
    OR p_result NOT IN ('clean','infected','error') OR p_result IS NULL THEN
    RAISE EXCEPTION 'Invalid antivirus completion.' USING ERRCODE='22023';
  END IF;
  UPDATE public.budget_attachments a SET
    scan_status=p_result,
    scanned_at=now(),
    scan_engine=CASE WHEN p_result='error' THEN NULL ELSE 'clamav' END,
    scan_result=left(coalesce(p_detail,p_result),255)
  WHERE a.id=p_id
    AND a.scan_status='scanning'
    AND a.scan_attempts=p_attempt_count
  RETURNING a.id INTO v_id;
  RETURN v_id IS NOT NULL;
END;
$complete_v2$;
REVOKE ALL ON FUNCTION public.tercis_complete_attachment_scan_v2(
  uuid,integer,text,text
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tercis_complete_attachment_scan_v2(
  uuid,integer,text,text
) TO service_role;

-- Disable the pre-token endpoints. An older deployed worker may temporarily
-- stop processing until updated, but must NOT approve an attachment unsafely.
-- Apply the migration and deploy the v2 worker together in a controlled window.
CREATE OR REPLACE FUNCTION public.tercis_claim_attachment_scans(
  p_limit integer DEFAULT 10
) RETURNS TABLE(id uuid,file_path text,mime_type text,size_bytes bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $deprecated_claim$
BEGIN
  RAISE EXCEPTION 'Legacy scanner claim RPC disabled: deploy v2 worker.'
    USING ERRCODE='42501';
END;
$deprecated_claim$;
CREATE OR REPLACE FUNCTION public.tercis_complete_attachment_scan(
  p_id uuid,p_result text,p_detail text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $deprecated_complete$
BEGIN
  RAISE EXCEPTION 'Legacy scanner completion RPC disabled: deploy v2 worker.'
    USING ERRCODE='42501';
END;
$deprecated_complete$;
REVOKE ALL ON FUNCTION public.tercis_claim_attachment_scans(integer)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.tercis_complete_attachment_scan(uuid,text,text)
  FROM PUBLIC,anon,authenticated,service_role;
