BEGIN;
INSERT INTO public.organizations(id,slug,name) VALUES
 ('10000000-0000-4000-8000-000000000001','catalog-meta-a','Catalog A'),
 ('10000000-0000-4000-8000-000000000002','catalog-meta-b','Catalog B');
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('20000000-0000-4000-8000-000000000001','catalog-a@example.test','{}'),
 ('20000000-0000-4000-8000-000000000002','catalog-b@example.test','{}');
UPDATE public.profiles SET active=true,role='collaborator',organization_id=CASE
 WHEN id='20000000-0000-4000-8000-000000000001' THEN '10000000-0000-4000-8000-000000000001'::uuid
 ELSE '10000000-0000-4000-8000-000000000002'::uuid END
WHERE id IN ('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002');
INSERT INTO public.custom_catalog_items(code,description,brand,category,unit_cost,price_pending,source_url,organization_id,created_by)
VALUES('META-ABB','Reference A','ABB','Protection',0,true,'https://new.abb.com/',
 '10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001'),
 ('META-PRIVATE','Confidential purchase B','Hager','Protection',125,false,'https://hager.com/',
 '10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002');
UPDATE public.custom_catalog_items SET image_url='/catalog/test.jpg',image_caption='Family photograph',specifications='{"Poles":"1"}'::jsonb WHERE code='META-ABB';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"aal":"aal2","sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
DO $$ DECLARE page jsonb; summary jsonb; BEGIN
 summary:=public.tercis_catalog_summary();
 IF (summary->>'total')::int<>1 OR (summary->>'pending_prices')::int<>1 THEN RAISE EXCEPTION 'Cross-tenant catalog summary'; END IF;
 page:=public.tercis_catalog_page_v2('','',0,20,'','ABB');
 IF (page->>'total')::int<>1 OR page->'items'->0->>'price_pending'<>'true'
  OR page->'items'->0->>'source_url'<>'https://new.abb.com/' THEN RAISE EXCEPTION 'Reference metadata missing'; END IF;
 IF page->'items'->0->>'image_url'<>'/catalog/test.jpg' OR page->'items'->0->'specifications'->>'Poles'<>'1' THEN RAISE EXCEPTION 'Product detail metadata missing'; END IF;
 page:=public.tercis_catalog_page_v2('','',0,20,'','Hager');
 IF (page->>'total')::int<>0 THEN RAISE EXCEPTION 'Brand filter leaked another tenant'; END IF;
 page:=public.tercis_catalog_page_v2('NO-MATCH','',0,20,'','');
 IF (page->>'total')::int<>0 THEN RAISE EXCEPTION 'Search ignored'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT set_config('request.jwt.claims','{}',true);
UPDATE public.profiles SET role='client' WHERE id='20000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"aal":"aal2","sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
DO $$ BEGIN
 BEGIN
  PERFORM public.tercis_catalog_summary();RAISE EXCEPTION 'Client read purchase summary';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.tercis_catalog_page_v2();RAISE EXCEPTION 'Client read purchase catalog';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT 'Catalog sources, pending prices, brand filters and tenant privacy: passed' AS verification;
ROLLBACK;
