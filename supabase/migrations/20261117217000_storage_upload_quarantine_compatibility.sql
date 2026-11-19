-- Supabase Storage uses different SELECT operations for authenticated downloads
-- and listings. Keep these SELECTs strictly limited to clean files.
-- A normal non-upsert upload needs INSERT only; never expose pending files via
-- an extra SELECT policy merely to support upload responses.
DROP POLICY IF EXISTS "Tercis private attachments staff read" ON storage.objects;
DROP POLICY IF EXISTS "Tercis private attachments upload response" ON storage.objects;
CREATE POLICY "Tercis private attachments staff read" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id='tercis-private-attachments'
    AND public.tercis_can_manage_quote_attachment(name)
    AND storage.allow_any_operation(ARRAY[
      'object.get_authenticated','object.get_authenticated_info','object.list'
    ])
    AND EXISTS (
      SELECT 1 FROM public.budget_attachments a
      WHERE a.file_path=name AND a.scan_status='clean'
    )
  );
-- Explicitly deny direct generic SELECTs and any Storage operation not listed
-- above. Upload INSERT, customer/tenant isolation and quarantine remain intact.
