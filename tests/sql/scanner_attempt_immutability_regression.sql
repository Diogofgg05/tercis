-- Two high-risk regressions:
--   * an authenticated uploader cannot delete a CLEAN object and reuse its path;
--   * a late ClamAV response cannot release bytes after a second scan claims them.
-- SQL is executed only on isolated PostgreSQL CI and rolled back.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL storage.operation='object.get_authenticated';
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claims='{"aal":"aal2"}';
INSERT INTO storage.objects(bucket_id,name,owner_id)
VALUES(
  'tercis-private-attachments',
  '00000000-0000-4000-8000-000000000900/00000000-0000-4000-8000-000000000200/00000000-0000-4000-8000-000000000851-proof.pdf',
  auth.uid()::text
);
INSERT INTO public.budget_attachments(
  budget_id,company_id,uploaded_by,file_name,file_path,mime_type,size_bytes,visibility
) VALUES(
  '00000000-0000-4000-8000-000000000200',
  '00000000-0000-4000-8000-000000000100',
  auth.uid(),'proof.pdf',
  '00000000-0000-4000-8000-000000000900/00000000-0000-4000-8000-000000000200/00000000-0000-4000-8000-000000000851-proof.pdf',
  'application/pdf',128,'internal'
);
SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claim.role='service_role';
DO $scan$
DECLARE v_claim record;
BEGIN
  SELECT * INTO v_claim FROM public.tercis_claim_attachment_scans_v2(50)
    WHERE file_path LIKE '%000000000851-proof.pdf';
  IF v_claim.id IS NULL OR v_claim.attempt_count<>1 THEN
    RAISE EXCEPTION 'FIRST SCAN ATTEMPT NOT ISSUED';
  END IF;
  IF public.tercis_complete_attachment_scan_v2(
      v_claim.id,v_claim.attempt_count,'clean','OK'
    ) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'CLEAN SCAN ATTEMPT REJECTED';
  END IF;
END
$scan$;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role='authenticated';
SET LOCAL storage.operation='object.get_authenticated';
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
DO $immutable$
DECLARE v_path text :=
  '00000000-0000-4000-8000-000000000900/'||
  '00000000-0000-4000-8000-000000000200/'||
  '00000000-0000-4000-8000-000000000851-proof.pdf';
DECLARE v_count integer;v_denied boolean:=false;
BEGIN
  SELECT count(*) INTO v_count FROM storage.objects WHERE name=v_path;
  IF v_count<>1 THEN RAISE EXCEPTION 'CLEAN SCANNED FILE NOT READABLE'; END IF;
  BEGIN
    DELETE FROM storage.objects WHERE name=v_path;
    GET DIAGNOSTICS v_count=ROW_COUNT;
    v_denied:=v_count=0;
  EXCEPTION WHEN insufficient_privilege OR SQLSTATE '42501' THEN
    v_denied:=true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'CRITICAL: AUTHENTICATED USER DELETED A CLEAN SCANNED OBJECT';
  END IF;
END
$immutable$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claims='{"aal":"aal2"}';
INSERT INTO storage.objects(bucket_id,name,owner_id)
VALUES(
  'tercis-private-attachments',
  '00000000-0000-4000-8000-000000000900/00000000-0000-4000-8000-000000000200/00000000-0000-4000-8000-000000000852-race.pdf',
  auth.uid()::text
);
INSERT INTO public.budget_attachments(
  budget_id,company_id,uploaded_by,file_name,file_path,mime_type,size_bytes,visibility
) VALUES(
  '00000000-0000-4000-8000-000000000200',
  '00000000-0000-4000-8000-000000000100',
  auth.uid(),'race.pdf',
  '00000000-0000-4000-8000-000000000900/00000000-0000-4000-8000-000000000200/00000000-0000-4000-8000-000000000852-race.pdf',
  'application/pdf',128,'internal'
);
SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claim.role='service_role';
DO $race$
DECLARE v_first record;v_second record;v_status text;v_attempt integer;
DECLARE v_legacy_denied boolean:=false;v_updated boolean;
BEGIN
  SELECT * INTO v_first FROM public.tercis_claim_attachment_scans_v2(50)
    WHERE file_path LIKE '%000000000852-race.pdf';
  IF v_first.id IS NULL OR v_first.attempt_count<>1 THEN
    RAISE EXCEPTION 'FIRST RACE ATTEMPT MISSING';
  END IF;
  -- An interrupted worker's lease expires; a second worker claims it.
  UPDATE public.budget_attachments
    SET scan_started_at=now()-interval '16 minutes'
    WHERE id=v_first.id;
  SELECT * INTO v_second FROM public.tercis_claim_attachment_scans_v2(50)
    WHERE id=v_first.id;
  IF v_second.id IS DISTINCT FROM v_first.id OR
    v_second.attempt_count<>v_first.attempt_count+1 THEN
    RAISE EXCEPTION 'RACE RE-CLAIM DID NOT ROTATE ATTEMPT TOKEN';
  END IF;
  v_updated:=public.tercis_complete_attachment_scan_v2(
    v_first.id,v_first.attempt_count,'clean','STALE CLEAN');
  IF v_updated IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'CRITICAL: STALE SCAN MARKED FILE CLEAN';
  END IF;
  SELECT scan_status,scan_attempts INTO v_status,v_attempt
    FROM public.budget_attachments WHERE id=v_first.id;
  IF v_status<>'scanning' OR v_attempt<>2 THEN
    RAISE EXCEPTION 'STALE ATTEMPT MUTATED CURRENT SCAN';
  END IF;
  v_updated:=public.tercis_complete_attachment_scan_v2(
    v_second.id,v_second.attempt_count,'infected','EICAR-Test-Signature');
  IF v_updated IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'CURRENT ATTEMPT COULD NOT QUARANTINE INFECTED FILE';
  END IF;
  SELECT scan_status INTO v_status FROM public.budget_attachments
    WHERE id=v_first.id;
  IF v_status<>'infected' THEN
    RAISE EXCEPTION 'CURRENT INFECTED SCAN DID NOT WIN';
  END IF;
  BEGIN
    PERFORM public.tercis_complete_attachment_scan(
      v_second.id,'clean','UNSAFE LEGACY');
  EXCEPTION WHEN insufficient_privilege OR SQLSTATE '42501' THEN
    v_legacy_denied:=true;
  END;
  IF NOT v_legacy_denied THEN
    RAISE EXCEPTION 'LEGACY COMPLETION CAN BYPASS ATTEMPT TOKEN';
  END IF;
END
$race$;
ROLLBACK;
SELECT 'Immutable scanned Storage objects and tokenized antivirus retry PASSED' AS result;
