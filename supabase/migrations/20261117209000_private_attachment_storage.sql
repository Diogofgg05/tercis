/*
  Private tenant-specific quote attachments.
  Storage object layout: <organization-uuid>/<budget-uuid>/<random-uuid>-<filename>.
  CLIENT ACCESS IS DENIED until a separately reviewed per-publication
  attachment grant protocol is introduced. Staff only; no public URLs.

  WARNING: storage.* exists in real Supabase. The CI stand-in is intentionally
  incomplete; test with the Storage API in Supabase staging before launch.
*/
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('tercis-private-attachments','tercis-private-attachments',false,10485760,
  ARRAY['application/pdf','image/png','image/jpeg','image/webp','text/plain'])
ON CONFLICT (id) DO UPDATE SET
  public=false,file_size_limit=EXCLUDED.file_size_limit,
  allowed_mime_types=EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.tercis_attachment_path_budget(p_path text)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE
SET search_path=public,pg_temp AS $$
DECLARE v_segments text[];
BEGIN
  v_segments:=string_to_array(p_path,'/');
  IF array_length(v_segments,1)<>3 OR
    v_segments[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR
    v_segments[2] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR
    v_segments[3] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[^/]+$' THEN
    RETURN NULL;
  END IF;
  RETURN v_segments[2]::uuid;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_attachment_path_budget(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_attachment_path_budget(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.tercis_can_manage_quote_attachment(p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=public,pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.budgets b
    JOIN public.profiles p ON p.id=(SELECT auth.uid()) AND p.active IS TRUE
    WHERE b.id=public.tercis_attachment_path_budget(p_path)
      AND p.organization_id IS NOT NULL
      AND b.organization_id=p.organization_id
      AND split_part(p_path,'/',1)=b.organization_id::text
      AND b.company_id IS NOT NULL
      AND (
        p.role IN ('admin','company_admin')
        OR (p.role='collaborator' AND p.collaborator_type='internal'
          AND (b.created_by=p.id OR b.assigned_to=p.id))
      )
      AND (
        p.role NOT IN ('admin','company_admin')
        OR public.tercis_verified_aal2()
      )
  );
$$;
REVOKE ALL ON FUNCTION public.tercis_can_manage_quote_attachment(text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_can_manage_quote_attachment(text)
  TO authenticated;

DROP POLICY IF EXISTS "Tercis private attachments staff read" ON storage.objects;
CREATE POLICY "Tercis private attachments staff read" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id='tercis-private-attachments'
    AND public.tercis_can_manage_quote_attachment(name)
  );
DROP POLICY IF EXISTS "Tercis private attachments staff upload" ON storage.objects;
CREATE POLICY "Tercis private attachments staff upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id='tercis-private-attachments'
    AND public.tercis_can_manage_quote_attachment(name)
  );
DROP POLICY IF EXISTS "Tercis private attachments staff delete" ON storage.objects;
CREATE POLICY "Tercis private attachments staff delete" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id='tercis-private-attachments'
    AND public.tercis_can_manage_quote_attachment(name)
    AND owner_id=(SELECT auth.uid())::text
  );

-- No UPDATE policy: use unique immutable paths, never overwrite a document.
-- A trusted operational cleanup job can remove orphans using service role.

CREATE OR REPLACE FUNCTION public.tercis_guard_attachment_metadata()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_org uuid; v_company uuid;
BEGIN
  SELECT b.organization_id,b.company_id INTO v_org,v_company
    FROM public.budgets b WHERE b.id=NEW.budget_id;
  IF v_org IS NULL OR NEW.company_id IS DISTINCT FROM v_company OR
     NEW.file_path IS NULL OR
     public.tercis_attachment_path_budget(NEW.file_path) IS DISTINCT FROM NEW.budget_id OR
     split_part(NEW.file_path,'/',1)<>v_org::text THEN
    RAISE EXCEPTION 'O anexo pertence a outro orçamento ou organização.'
      USING ERRCODE='42501';
  END IF;
  IF NEW.size_bytes<=0 OR NEW.size_bytes>10485760 THEN
    RAISE EXCEPTION 'O anexo deve ter entre 1 byte e 10 MB.'
      USING ERRCODE='22023';
  END IF;
  IF NEW.mime_type NOT IN (
    'application/pdf','image/png','image/jpeg','image/webp','text/plain'
  ) THEN
    RAISE EXCEPTION 'Formato de anexo não autorizado.' USING ERRCODE='22023';
  END IF;
  IF auth.uid() IS NOT NULL AND (
    NOT public.tercis_can_manage_quote_attachment(NEW.file_path)
    OR NEW.uploaded_by IS DISTINCT FROM auth.uid()
  ) THEN
    RAISE EXCEPTION 'Utilizador sem autorização para este anexo.'
      USING ERRCODE='42501';
  END IF;
  IF TG_OP='UPDATE' AND (
    NEW.file_path IS DISTINCT FROM OLD.file_path OR
    NEW.budget_id IS DISTINCT FROM OLD.budget_id OR
    NEW.company_id IS DISTINCT FROM OLD.company_id OR
    NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by
  ) THEN
    RAISE EXCEPTION 'O anexo é imutável: carregue uma nova versão.'
      USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tercis_guard_attachment_metadata_write ON public.budget_attachments;
CREATE TRIGGER tercis_guard_attachment_metadata_write
  BEFORE INSERT OR UPDATE ON public.budget_attachments
  FOR EACH ROW EXECUTE FUNCTION public.tercis_guard_attachment_metadata();

-- Existing broad SELECT on the metadata table is restricted to internal users.
DROP POLICY IF EXISTS "Tercis private attachment metadata scope" ON public.budget_attachments;
CREATE POLICY "Tercis private attachment metadata scope" ON public.budget_attachments
 AS RESTRICTIVE FOR ALL TO authenticated
 USING (
   public.tercis_can_manage_quote_attachment(file_path)
   AND visibility='internal'
 ) WITH CHECK (
   public.tercis_can_manage_quote_attachment(file_path)
   AND visibility='internal'
 );
DROP POLICY IF EXISTS "Tercis staff create attachment metadata" ON public.budget_attachments;
CREATE POLICY "Tercis staff create attachment metadata" ON public.budget_attachments
  FOR INSERT TO authenticated WITH CHECK (
    public.tercis_can_manage_quote_attachment(file_path)
    AND uploaded_by=(SELECT auth.uid())
    AND visibility='internal'
  );
DROP POLICY IF EXISTS "Tercis staff delete own attachment metadata" ON public.budget_attachments;
CREATE POLICY "Tercis staff delete own attachment metadata" ON public.budget_attachments
  FOR DELETE TO authenticated USING (
    public.tercis_can_manage_quote_attachment(file_path)
    AND uploaded_by=(SELECT auth.uid())
  );
CREATE UNIQUE INDEX IF NOT EXISTS tercis_attachment_unique_storage_path
  ON public.budget_attachments(file_path);
