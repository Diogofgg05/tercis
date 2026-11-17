-- Aged orphan inventory must never expose other tenants to a user nor
-- accidentally include a legitimate attachment or a recent in-flight upload.
BEGIN;
INSERT INTO storage.objects(bucket_id,name,owner_id,created_at)
VALUES
('tercis-private-attachments',
 '00000000-0000-4000-8000-000000000900/00000000-0000-4000-8000-000000000200/00000000-0000-4000-8000-000000000701-aged-orphan.pdf',
 '00000000-0000-4000-8000-000000000001',now()-interval '72 hours'),
('tercis-private-attachments',
 '00000000-0000-4000-8000-000000000900/00000000-0000-4000-8000-000000000200/00000000-0000-4000-8000-000000000702-new-orphan.pdf',
 '00000000-0000-4000-8000-000000000001',now()-interval '3 hours'),
('tercis-private-attachments',
 '00000000-0000-4000-8000-000000000900/00000000-0000-4000-8000-000000000200/00000000-0000-4000-8000-000000000703-recorded.pdf',
 '00000000-0000-4000-8000-000000000001',now()-interval '72 hours');
INSERT INTO public.budget_attachments(
 budget_id,company_id,uploaded_by,file_name,file_path,mime_type,size_bytes,visibility
) VALUES (
 '00000000-0000-4000-8000-000000000200',
 '00000000-0000-4000-8000-000000000100',
 '00000000-0000-4000-8000-000000000001',
 'recorded.pdf',
 '00000000-0000-4000-8000-000000000900/00000000-0000-4000-8000-000000000200/00000000-0000-4000-8000-000000000703-recorded.pdf',
 'application/pdf',100,'internal');

SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claim.role='service_role';
DO $$
DECLARE n integer; v text;
BEGIN
  SELECT count(*),min(path) INTO n,v
  FROM public.tercis_list_orphan_attachment_paths(50)
  WHERE path LIKE '%00000000070%';
  IF n<>1 OR v NOT LIKE '%000000000701-aged-orphan.pdf' THEN
    RAISE EXCEPTION 'UNSAFE ORPHAN INVENTORY: % candidates',n;
  END IF;
END $$;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role='authenticated';
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';
DO $$
DECLARE denied boolean:=false;
BEGIN
  BEGIN
    PERFORM public.tercis_list_orphan_attachment_paths(10);
  EXCEPTION WHEN insufficient_privilege OR SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'CLIENT CAN ENUMERATE ORPHAN FILES'; END IF;
END $$;
ROLLBACK;
SELECT 'Orphan candidates are aged, unregistered and service-only PASSED' AS result;
