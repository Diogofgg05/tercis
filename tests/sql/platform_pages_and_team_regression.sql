BEGIN;
INSERT INTO public.organizations(id,slug,name) VALUES('10000000-0000-4000-8000-000000000001','pages-test-a','Pages A'),('10000000-0000-4000-8000-000000000002','pages-test-b','Pages B');
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('20000000-0000-4000-8000-000000000001','pages-owner@example.test','{}'),('20000000-0000-4000-8000-000000000002','pages-manager@example.test','{}'),
 ('20000000-0000-4000-8000-000000000003','pages-colleague@example.test','{}'),('20000000-0000-4000-8000-000000000004','pages-foreign@example.test','{}'),('20000000-0000-4000-8000-000000000005','pages-customer@example.test','{}');
UPDATE public.profiles SET organization_id=CASE WHEN id='20000000-0000-4000-8000-000000000004' THEN '10000000-0000-4000-8000-000000000002'::uuid ELSE '10000000-0000-4000-8000-000000000001'::uuid END,active=true,
 role=CASE WHEN id IN ('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002') THEN 'company_admin' WHEN id='20000000-0000-4000-8000-000000000005' THEN 'client' ELSE 'collaborator' END
 WHERE id::text LIKE '20000000-0000-4000-8000-%';
INSERT INTO tercis_platform.administrators(user_id) VALUES('20000000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"aal":"aal2","role":"authenticated"}',true);
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
DO $$ DECLARE page jsonb;BEGIN
 page:=public.tercis_platform_data_page('users',NULL,'pages-');
 IF (page->>'total')::int<>5 OR page::text NOT LIKE '%pages-foreign%' OR page::text NOT LIKE '%app_admin%' THEN RAISE EXCEPTION 'Owner global users missing';END IF;
 page:=public.tercis_platform_data_page('users','10000000-0000-4000-8000-000000000001','pages-colleague');
 IF (page->>'total')::int<>1 OR page::text LIKE '%pages-foreign%' THEN RAISE EXCEPTION 'Global user filters ignored';END IF;
 PERFORM public.tercis_platform_data_page('budgets');PERFORM public.tercis_platform_data_page('catalog');PERFORM public.tercis_platform_data_page('activity');
END $$;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
DO $$ DECLARE team jsonb;BEGIN
 team:=public.tercis_company_team();
 IF jsonb_array_length(team)<>2 OR team::text LIKE '%pages-owner%' OR team::text LIKE '%pages-foreign%' OR team::text LIKE '%pages-customer%' THEN RAISE EXCEPTION 'Manager directory includes platform owner, customers or another company';END IF;
 BEGIN PERFORM public.tercis_platform_data_page('users');RAISE EXCEPTION 'Company manager accessed global users';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000003',true);
SELECT set_config('request.jwt.claims','{"aal":"aal1","role":"authenticated"}',true);
DO $$ DECLARE team jsonb;BEGIN
 team:=public.tercis_company_team();IF jsonb_array_length(team)<>2 OR team::text LIKE '%pages-foreign%' OR team::text LIKE '%pages-owner%' THEN RAISE EXCEPTION 'Collaborator directory escaped company';END IF;
 BEGIN PERFORM public.tercis_platform_data_page('users');RAISE EXCEPTION 'Collaborator accessed global users';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000005',true);
DO $$ BEGIN BEGIN PERFORM public.tercis_company_team();RAISE EXCEPTION 'Customer accessed internal team';EXCEPTION WHEN insufficient_privilege THEN NULL;END;END $$;
SELECT 'Global data pages, company-only team, owner/customer exclusion and role isolation: passed' AS verification;
ROLLBACK;
