/*
  Supabase Storage can require SELECT on the new row to return upload
  metadata (INSERT ... RETURNING). The quarantine previously denied every
  SELECT until a clean scan and could therefore reject legitimate uploads.

  Keep the object-upload response separate from file reads. Only the uploader
  within the authorized organization may inspect this upload response.
  Downloads and object listings remain denied until a service-approved scan.
  Operations are validated against Supabase's storage.allow_*_operation helpers;
  unrecognized/no operation is DENIED, including direct SQL reads.
*/
DROP POLICY IF EXISTS "Tercis private attachments staff read" ON storage.objects;
DROP POLICY IF EXISTS "Tercis private attachments upload response" ON storage.objects;

CREATE POLICY "Tercis private attachments staff read" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id='tercis-private-attachments'
    AND public.tercis_can_manage_quote_attachment(name)
    AND storage.allow_any_operation(ARRAY[
      'object.get_authenticated','object.list','object.list_v2'
    ])
    AND EXISTS (
      SELECT 1 FROM public.budget_attachments a
      WHERE a.file_path=name AND a.scan_status='clean'
    )
  );

CREATE POLICY "Tercis private attachments upload response" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id='tercis-private-attachments'
    AND storage.allow_only_operation('object.upload')
    AND owner_id=(SELECT auth.uid())::text
    AND public.tercis_can_manage_quote_attachment(name)
  );

-- Unlike the signed URL operation, authenticated GET requires an active JWT
-- and rechecks RLS for every download, enabling immediate revocation when a
-- user loses tenant access or a file is quarantined.
