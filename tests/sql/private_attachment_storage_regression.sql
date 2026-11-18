-- Storage objects are private and separated by owning organization and budget.
-- Both valid paths use distinct organization IDs and the same 3-segment shape.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claims='{"aal":"aal2"}';
DO $$
DECLARE allowed_path text; foreign_path text; denied boolean;
BEGIN
  allowed_path :=
    '00000000-0000-4000-8000-000000000900/'||
    '00000000-0000-4000-8000-000000000200/'||
    '00000000-0000-4000-8000-000000000411-quote.pdf';
  foreign_path :=
    '00000000-0000-4000-8000-000000000901/'||
    '00000000-0000-4000-8000-000000000280/'||
    '00000000-0000-4000-8000-000000000412-quote.pdf';
  IF NOT public.tercis_can_manage_quote_attachment(allowed_path)
    OR public.tercis_can_manage_quote_attachment(foreign_path)
    OR public.tercis_can_manage_quote_attachment('../private.pdf')
  THEN RAISE EXCEPTION 'ATTACHMENT PATH AUTHORIZATION FAILED'; END IF;

  INSERT INTO storage.objects(bucket_id,name,owner_id)
    VALUES('tercis-private-attachments',allowed_path,auth.uid()::text);

  INSERT INTO public.budget_attachments(
    budget_id,company_id,uploaded_by,file_name,file_path,mime_type,size_bytes,visibility
  ) VALUES (
    '00000000-0000-4000-8000-000000000200',
    '00000000-0000-4000-8000-000000000100',
    auth.uid(),'quote.pdf',allowed_path,'application/pdf',1234,'internal'
  );
  IF NOT EXISTS(SELECT 1 FROM public.budget_attachments WHERE file_path=allowed_path) THEN
    RAISE EXCEPTION 'ATTACHMENT METADATA NOT VISIBLE TO OWNER'; END IF;

  denied:=false;
  BEGIN
    INSERT INTO storage.objects(bucket_id,name,owner_id)
      VALUES('tercis-private-attachments',foreign_path,auth.uid()::text);
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'CROSS-TENANT FILE UPLOAD ACCEPTED'; END IF;

  denied:=false;
  BEGIN
    INSERT INTO public.budget_attachments(
      budget_id,company_id,uploaded_by,file_name,file_path,mime_type,size_bytes
    ) VALUES(
      '00000000-0000-4000-8000-000000000200',
      '00000000-0000-4000-8000-000000000100',
      auth.uid(),'forged.pdf',foreign_path,'application/pdf',100
    );
  EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'CROSS-TENANT ATTACHMENT METADATA ACCEPTED'; END IF;
END $$;
ROLLBACK;

-- Customer users cannot fetch even 'client' visibility records from raw
-- storage; a future portal distribution needs separate publication grants.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';
DO $$
DECLARE n integer; denied boolean:=false;
BEGIN
  SELECT count(*) INTO n FROM storage.objects
    WHERE bucket_id='tercis-private-attachments';
  IF n<>0 THEN RAISE EXCEPTION 'CUSTOMER CAN LIST STAFF OBJECTS'; END IF;
  SELECT count(*) INTO n FROM public.budget_attachments;
  IF n<>0 THEN RAISE EXCEPTION 'CUSTOMER CAN READ STAFF FILE METADATA'; END IF;
  BEGIN
    INSERT INTO storage.objects(bucket_id,name,owner_id)
    VALUES('tercis-private-attachments',
      '00000000-0000-4000-8000-000000000900/00000000-0000-4000-8000-000000000200/00000000-0000-4000-8000-000000000413-file.pdf',
      auth.uid()::text);
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'CUSTOMER UPLOADED STAFF FILE'; END IF;
END $$;
ROLLBACK;

-- Platform administrator has no commercial tenant.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000006';
DO $$
BEGIN
  IF public.tercis_can_manage_quote_attachment(
    '00000000-0000-4000-8000-000000000900/00000000-0000-4000-8000-000000000200/00000000-0000-4000-8000-000000000411-quote.pdf'
  ) THEN RAISE EXCEPTION 'PLATFORM ADMIN CAN READ TENANT FILE'; END IF;
END $$;
ROLLBACK;
SELECT 'Private quote attachments are isolated by owning organization PASSED' AS result;
