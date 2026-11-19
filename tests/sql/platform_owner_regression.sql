BEGIN;
INSERT INTO public.organizations(id,slug,name) VALUES
 ('10000000-0000-4000-8000-000000000001','platform-test-a','Platform A'),
 ('10000000-0000-4000-8000-000000000002','platform-test-b','Platform B');
INSERT INTO auth.users(id,email,raw_user_meta_data,email_confirmed_at) VALUES
 ('20000000-0000-4000-8000-000000000001','platform-owner@example.test','{}',now()),
 ('20000000-0000-4000-8000-000000000002','company-manager@example.test','{}',now()),
 ('20000000-0000-4000-8000-000000000003','external-account@example.test','{}',now()),
 ('20000000-0000-4000-8000-000000000004','new-managed@example.test','{}',now()),
 ('20000000-0000-4000-8000-000000000005','new-admin@example.test','{}',now()),
 ('20000000-0000-4000-8000-000000000006','legacy-company-admin@example.test','{}',now());
UPDATE public.profiles SET active=true,role='company_admin',organization_id='10000000-0000-4000-8000-000000000001'
 WHERE id IN ('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002');
UPDATE public.profiles SET active=true,role='collaborator',organization_id='10000000-0000-4000-8000-000000000002' WHERE id='20000000-0000-4000-8000-000000000003';
UPDATE public.profiles SET active=true,role='admin',organization_id='10000000-0000-4000-8000-000000000002' WHERE id='20000000-0000-4000-8000-000000000006';
INSERT INTO tercis_platform.administrators(user_id) VALUES('20000000-0000-4000-8000-000000000001');
INSERT INTO public.custom_catalog_items(code,description,unit_cost,organization_id,created_by) VALUES
 ('OWNER-A','Private A',15,'10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001'),
 ('OWNER-B','Private B',25,'10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"aal":"aal2","role":"authenticated"}',true);
DO $$ BEGIN
 IF NOT public.tercis_is_platform_admin() THEN RAISE EXCEPTION 'Owner registration absent';END IF;
 IF public.tercis_platform_organizations()::text NOT LIKE '%Platform B%' THEN RAISE EXCEPTION 'Owner cannot list all organizations';END IF;
 PERFORM public.tercis_enter_organization('10000000-0000-4000-8000-000000000002');
 IF public.tercis_current_organization_id()<>'10000000-0000-4000-8000-000000000002' THEN RAISE EXCEPTION 'Owner switch failed';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.custom_catalog_items WHERE code='OWNER-B') OR EXISTS(SELECT 1 FROM public.custom_catalog_items WHERE code='OWNER-A') THEN RAISE EXCEPTION 'Workspace RLS did not follow selected organization';END IF;
 BEGIN UPDATE public.profiles SET role='admin' WHERE id=auth.uid();RAISE EXCEPTION 'Owner changed profile permissions outside audited RPC';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN UPDATE public.profiles SET organization_id='10000000-0000-4000-8000-000000000001' WHERE id=auth.uid();RAISE EXCEPTION 'Workspace switch flag leaked';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
SELECT set_config('request.jwt.claims','{"aal":"aal1","role":"authenticated"}',true);
DO $$ BEGIN
 BEGIN PERFORM public.tercis_enter_organization('10000000-0000-4000-8000-000000000001');RAISE EXCEPTION 'AAL1 owner switched organization';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.tercis_platform_organizations();RAISE EXCEPTION 'AAL1 owner listed organizations';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000006',true);
SELECT set_config('request.jwt.claims','{"aal":"aal2","role":"authenticated"}',true);
DO $$ BEGIN
 BEGIN PERFORM public.tercis_admin_update_user('20000000-0000-4000-8000-000000000001','collaborator',true,NULL);RAISE EXCEPTION 'Legacy company administrator downgraded platform owner';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"aal":"aal2","role":"authenticated"}',true);
DO $$ BEGIN
 IF public.tercis_is_platform_admin() THEN RAISE EXCEPTION 'Company manager acquired platform ownership';END IF;
 PERFORM public.tercis_provisioning_scope('10000000-0000-4000-8000-000000000001');
 BEGIN PERFORM public.tercis_provisioning_scope('10000000-0000-4000-8000-000000000002');RAISE EXCEPTION 'Manager can create another company accounts';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.tercis_enter_organization('10000000-0000-4000-8000-000000000002');RAISE EXCEPTION 'Manager switched tenant';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN INSERT INTO tercis_platform.administrators(user_id) VALUES(auth.uid());RAISE EXCEPTION 'Manager self promoted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.tercis_complete_team_account(auth.uid(),'20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','collaborator','Managed');RAISE EXCEPTION 'Authenticated called service-only completion';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SET LOCAL ROLE service_role;
DO $$ BEGIN
 BEGIN PERFORM public.tercis_complete_team_account('20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000002','collaborator','Managed');RAISE EXCEPTION 'Completion escaped company scope';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.tercis_complete_team_account('20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','company_admin','Managed');RAISE EXCEPTION 'Manager appointed another administrator';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.tercis_complete_team_account('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','collaborator','Managed');RAISE EXCEPTION 'Existing external account appropriated';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 PERFORM public.tercis_complete_team_account('20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','collaborator','Managed');
 PERFORM public.tercis_complete_team_account('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000002','company_admin','Managed administrator');
END $$;
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id='20000000-0000-4000-8000-000000000004' AND active AND role='collaborator' AND organization_id='10000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Managed account not activated';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.audit_logs WHERE actor_id='20000000-0000-4000-8000-000000000001' AND action='platform_workspace_entered') THEN RAISE EXCEPTION 'Missing platform audit';END IF;
END $$;
SELECT 'Platform ownership, audited tenant switch, MFA and scoped account creation: passed' AS verification;
ROLLBACK;
