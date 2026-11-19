-- Qualify the outer Storage path: companies also has a column named `name`.
ALTER POLICY "Read visible company logos" ON storage.objects
 USING(bucket_id='tercis-company-media' AND EXISTS (
  SELECT 1 FROM public.companies c WHERE c.organization_id::text=split_part(objects.name,'/',1)
  AND c.id::text=split_part(objects.name,'/',2)));
ALTER POLICY "Company administrators upload logos" ON storage.objects
 WITH CHECK(bucket_id='tercis-company-media' AND public.tercis_verified_aal2()
  AND EXISTS(SELECT 1 FROM public.profiles p JOIN public.companies c ON c.organization_id=p.organization_id
   WHERE p.id=auth.uid() AND p.active IS TRUE AND p.role IN ('admin','company_admin')
    AND p.organization_id::text=split_part(objects.name,'/',1) AND c.id::text=split_part(objects.name,'/',2)));
ALTER POLICY "Company administrators remove logos" ON storage.objects
 USING(bucket_id='tercis-company-media' AND public.tercis_verified_aal2()
  AND EXISTS(SELECT 1 FROM public.profiles p JOIN public.companies c ON c.organization_id=p.organization_id
   WHERE p.id=auth.uid() AND p.active IS TRUE AND p.role IN ('admin','company_admin')
    AND p.organization_id::text=split_part(objects.name,'/',1) AND c.id::text=split_part(objects.name,'/',2)));
