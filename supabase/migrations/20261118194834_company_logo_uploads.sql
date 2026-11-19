ALTER TABLE public.companies ADD COLUMN logo_path text;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('tercis-company-media','tercis-company-media',false,5242880,
 ARRAY['image/png','image/jpeg','image/webp']) ON CONFLICT(id) DO NOTHING;

CREATE POLICY "Read visible company logos" ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='tercis-company-media' AND EXISTS (
  SELECT 1 FROM public.companies c WHERE c.organization_id::text=split_part(name,'/',1)
  AND c.id::text=split_part(name,'/',2)));
CREATE POLICY "Company administrators upload logos" ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='tercis-company-media' AND public.tercis_verified_aal2()
  AND EXISTS(SELECT 1 FROM public.profiles p JOIN public.companies c ON c.organization_id=p.organization_id
   WHERE p.id=auth.uid() AND p.active IS TRUE AND p.role IN ('admin','company_admin')
    AND p.organization_id::text=split_part(name,'/',1) AND c.id::text=split_part(name,'/',2)));
CREATE POLICY "Company administrators remove logos" ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='tercis-company-media' AND public.tercis_verified_aal2()
  AND EXISTS(SELECT 1 FROM public.profiles p JOIN public.companies c ON c.organization_id=p.organization_id
   WHERE p.id=auth.uid() AND p.active IS TRUE AND p.role IN ('admin','company_admin')
    AND p.organization_id::text=split_part(name,'/',1) AND c.id::text=split_part(name,'/',2)));
