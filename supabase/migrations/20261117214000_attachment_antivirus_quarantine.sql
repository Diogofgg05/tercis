-- Fail-closed antimalware quarantine for all private attachments.
-- Files are initially PENDING and CANNOT be downloaded by staff until a
-- trusted service worker has completed a real antivirus scan.
ALTER TABLE public.budget_attachments
  ADD COLUMN IF NOT EXISTS scan_status text NOT NULL DEFAULT 'pending'
    CHECK (scan_status IN ('pending','scanning','clean','infected','error')),
  ADD COLUMN IF NOT EXISTS scan_attempts integer NOT NULL DEFAULT 0
    CHECK (scan_attempts BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS scan_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS scanned_at timestamptz,
  ADD COLUMN IF NOT EXISTS scan_engine text,
  ADD COLUMN IF NOT EXISTS scan_result text;
CREATE INDEX IF NOT EXISTS tercis_pending_attachment_scans
  ON public.budget_attachments(scan_status,created_at)
  WHERE scan_status IN ('pending','scanning','error');

-- Client-supplied metadata cannot forge clean scans or trusted scan results.
CREATE OR REPLACE FUNCTION public.tercis_guard_attachment_scan_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF TG_OP='INSERT' AND
      (NEW.scan_status<>'pending' OR NEW.scan_attempts<>0
        OR NEW.scan_started_at IS NOT NULL OR NEW.scanned_at IS NOT NULL
        OR NEW.scan_engine IS NOT NULL OR NEW.scan_result IS NOT NULL) THEN
      RAISE EXCEPTION 'A aprovação de anexos é exclusiva do scanner.'
        USING ERRCODE='42501';
    END IF;
    IF TG_OP='UPDATE' AND
      (NEW.scan_status IS DISTINCT FROM OLD.scan_status OR
       NEW.scan_attempts IS DISTINCT FROM OLD.scan_attempts OR
       NEW.scan_started_at IS DISTINCT FROM OLD.scan_started_at OR
       NEW.scanned_at IS DISTINCT FROM OLD.scanned_at OR
       NEW.scan_engine IS DISTINCT FROM OLD.scan_engine OR
       NEW.scan_result IS DISTINCT FROM OLD.scan_result) THEN
      RAISE EXCEPTION 'A análise de anexos é controlada pelo servidor.'
        USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tercis_guard_attachment_scan_fields_write ON public.budget_attachments;
CREATE TRIGGER tercis_guard_attachment_scan_fields_write
  BEFORE INSERT OR UPDATE ON public.budget_attachments FOR EACH ROW
  EXECUTE FUNCTION public.tercis_guard_attachment_scan_fields();
REVOKE ALL ON FUNCTION public.tercis_guard_attachment_scan_fields()
  FROM PUBLIC,anon,authenticated;

-- Storage RLS applies to real private-object downloads, not only the UI.
DROP POLICY IF EXISTS "Tercis private attachments staff read" ON storage.objects;
CREATE POLICY "Tercis private attachments staff read" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id='tercis-private-attachments'
    AND public.tercis_can_manage_quote_attachment(name)
    AND EXISTS (
      SELECT 1 FROM public.budget_attachments a
      WHERE a.file_path=name AND a.scan_status='clean'
    )
  );
-- Upload (INSERT) remains allowed to authorized internal staff; it does not
-- automatically make an object SELECTable. No customer read policy exists.

CREATE OR REPLACE FUNCTION public.tercis_claim_attachment_scans(
  p_limit integer DEFAULT 10
) RETURNS TABLE(id uuid,file_path text,mime_type text,size_bytes bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Apenas o scanner autenticado pode reclamar anexos.'
      USING ERRCODE='42501';
  END IF;
  RETURN QUERY
  WITH picked AS (
    SELECT a.id FROM public.budget_attachments a
    WHERE (
      a.scan_status='pending'
      OR (a.scan_status='scanning'
          AND a.scan_started_at<now()-interval '15 minutes')
      OR (a.scan_status='error'
          AND a.scanned_at<now()-interval '10 minutes')
    )
    AND a.scan_attempts<3
    ORDER BY a.created_at,a.id
    FOR UPDATE SKIP LOCKED LIMIT greatest(1,least(coalesce(p_limit,10),50))
  ), updated AS (
    UPDATE public.budget_attachments a SET
      scan_status='scanning', scan_attempts=a.scan_attempts+1,
      scan_started_at=now(),scanned_at=NULL,scan_engine=NULL,scan_result=NULL
    FROM picked p WHERE p.id=a.id
    RETURNING a.id,a.file_path,a.mime_type,a.size_bytes
  )
  SELECT u.id,u.file_path,u.mime_type,u.size_bytes FROM updated u;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_claim_attachment_scans(integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tercis_claim_attachment_scans(integer)
  TO service_role;

CREATE OR REPLACE FUNCTION public.tercis_complete_attachment_scan(
  p_id uuid,p_result text,p_detail text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_updated uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Apenas o scanner confiável pode aprovar um anexo.'
      USING ERRCODE='42501';
  END IF;
  IF p_result NOT IN ('clean','infected','error') THEN
    RAISE EXCEPTION 'Resultado de scanner inválido.' USING ERRCODE='22023';
  END IF;
  UPDATE public.budget_attachments a SET
    scan_status=p_result, scanned_at=now(), scan_engine='clamav',
    scan_result=left(coalesce(p_detail,p_result),255)
  WHERE a.id=p_id AND a.scan_status='scanning'
  RETURNING a.id INTO v_updated;
  RETURN v_updated IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_complete_attachment_scan(uuid,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tercis_complete_attachment_scan(uuid,text,text)
  TO service_role;

-- This migration does not auto-approve pre-existing rows. Existing attachments
-- remain pending and must pass the same trusted scanner.
