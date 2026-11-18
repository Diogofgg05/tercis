-- Antimalware regression: unscanned, infected and failed files cannot be
-- downloaded even by their uploader. Only a service scan can release them.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL storage.operation='object.get_authenticated';
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claims='{"aal":"aal2"}';
DO $$
DECLARE v_path text; v_id uuid; n integer; blocked boolean:=false;
BEGIN
  v_path:='00000000-0000-4000-8000-000000000900/'||
    '00000000-0000-4000-8000-000000000200/'||
    '00000000-0000-4000-8000-000000000801-invoice.pdf';
  INSERT INTO storage.objects(bucket_id,name,owner_id)
  VALUES('tercis-private-attachments',v_path,auth.uid()::text);
  INSERT INTO public.budget_attachments(
    budget_id,company_id,uploaded_by,file_name,file_path,mime_type,size_bytes,visibility
  ) VALUES(
    '00000000-0000-4000-8000-000000000200',
    '00000000-0000-4000-8000-000000000100',
    auth.uid(),'invoice.pdf',v_path,'application/pdf',100,'internal'
  ) RETURNING id INTO v_id;
  SELECT count(*) INTO n FROM storage.objects WHERE name=v_path;
  IF n<>0 THEN RAISE EXCEPTION 'PENDING SCAN FILE EXPOSED'; END IF;
  BEGIN
    UPDATE public.budget_attachments SET scan_status='clean' WHERE id=v_id;
    GET DIAGNOSTICS n=ROW_COUNT;
    blocked:=n=0;
  EXCEPTION WHEN insufficient_privilege OR SQLSTATE '42501' THEN blocked:=true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'USER FORGED CLEAN SCAN'; END IF;
  blocked:=false;
  BEGIN
    INSERT INTO public.budget_attachments(
      budget_id,company_id,uploaded_by,file_name,file_path,mime_type,size_bytes,
      visibility,scan_status
    ) VALUES(
      '00000000-0000-4000-8000-000000000200',
      '00000000-0000-4000-8000-000000000100',
      auth.uid(),'fake.pdf',
      '00000000-0000-4000-8000-000000000900/00000000-0000-4000-8000-000000000200/00000000-0000-4000-8000-000000000802-fake.pdf',
      'application/pdf',100,'internal','clean'
    );
  EXCEPTION WHEN insufficient_privilege OR SQLSTATE '42501' THEN blocked:=true;
  END;
END $$;
SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claim.role='service_role';
DO $$
DECLARE v_scan record; updated boolean;
BEGIN
  SELECT * INTO v_scan FROM public.tercis_claim_attachment_scans_v2(50)
    WHERE file_path LIKE '%000000000801-invoice.pdf';
  IF v_scan.id IS NULL THEN RAISE EXCEPTION 'NO SCAN CLAIMED'; END IF;
  updated:=public.tercis_complete_attachment_scan_v2(v_scan.id,v_scan.attempt_count,'infected','EICAR-Test-Signature');
  IF updated IS DISTINCT FROM true THEN RAISE EXCEPTION 'INFECTED SCAN NOT STORED'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SET LOCAL storage.operation='object.get_authenticated';
SET LOCAL request.jwt.claim.role='authenticated';
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM storage.objects
    WHERE name LIKE '%000000000801-invoice.pdf';
  IF n<>0 THEN RAISE EXCEPTION 'INFECTED OBJECT VISIBLE AFTER SCAN'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL storage.operation='object.get_authenticated';
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claims='{"aal":"aal2"}';
INSERT INTO storage.objects(bucket_id,name,owner_id)
VALUES('tercis-private-attachments',
  '00000000-0000-4000-8000-000000000900/00000000-0000-4000-8000-000000000200/00000000-0000-4000-8000-000000000803-safe.pdf',
  '00000000-0000-4000-8000-000000000001');
INSERT INTO public.budget_attachments(
  budget_id,company_id,uploaded_by,file_name,file_path,mime_type,size_bytes,visibility
) VALUES(
  '00000000-0000-4000-8000-000000000200',
  '00000000-0000-4000-8000-000000000100',
  '00000000-0000-4000-8000-000000000001','safe.pdf',
  '00000000-0000-4000-8000-000000000900/00000000-0000-4000-8000-000000000200/00000000-0000-4000-8000-000000000803-safe.pdf',
  'application/pdf',100,'internal'
);
SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claim.role='service_role';
DO $$
DECLARE v_scan record; updated boolean;
BEGIN
  SELECT * INTO v_scan FROM public.tercis_claim_attachment_scans_v2(50)
    WHERE file_path LIKE '%000000000803-safe.pdf';
  IF v_scan.id IS NULL OR v_scan.file_path NOT LIKE '%000000000803-safe.pdf' THEN
    RAISE EXCEPTION 'SAFE FIXTURE NOT CLAIMED'; END IF;
  updated:=public.tercis_complete_attachment_scan_v2(v_scan.id,v_scan.attempt_count,'clean','OK');
  IF updated IS DISTINCT FROM true THEN RAISE EXCEPTION 'CLEAN SCAN NOT SAVED'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SET LOCAL storage.operation='object.get_authenticated';
SET LOCAL request.jwt.claim.role='authenticated';
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM storage.objects
    WHERE name LIKE '%000000000803-safe.pdf';
  IF n<>1 THEN RAISE EXCEPTION 'CLEAN FILE NOT RELEASED'; END IF;
  PERFORM set_config('storage.operation','',true);
  SELECT count(*) INTO n FROM storage.objects
    WHERE name LIKE '%000000000803-safe.pdf';
  IF n<>0 THEN RAISE EXCEPTION 'GENERIC SQL SELECT EXPOSED SCANNED FILE'; END IF;
  PERFORM set_config('storage.operation','object.upload',true);
  SELECT count(*) INTO n FROM storage.objects
    WHERE name LIKE '%000000000803-safe.pdf';
  IF n<>0 THEN RAISE EXCEPTION 'UPLOAD OPERATION EXPOSED FILE'; END IF;
  PERFORM set_config('storage.operation','object.list',true);
  SELECT count(*) INTO n FROM storage.objects
    WHERE name LIKE '%000000000803-safe.pdf';
  IF n<>1 THEN RAISE EXCEPTION 'STORAGE LIST CANNOT SEE CLEAN FILE'; END IF;
END $$;
ROLLBACK;
SELECT 'Private attachment quarantine and trusted scan verdict PASSED' AS result;
