BEGIN;
INSERT INTO public.organizations(id,slug,name) VALUES
 ('10000000-0000-4000-8000-000000000001','contact-test-a','Contact A'),
 ('10000000-0000-4000-8000-000000000002','contact-test-b','Contact B'),
 ('10000000-0000-4000-8000-000000000003','contact-test-c','Contact C');
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('20000000-0000-4000-8000-000000000001','contact-admin@example.test','{}'),
 ('20000000-0000-4000-8000-000000000002','contact-peer@example.test','{}'),
 ('20000000-0000-4000-8000-000000000003','contact-other@example.test','{}');
UPDATE public.profiles SET active=true,role=CASE WHEN id='20000000-0000-4000-8000-000000000001' THEN 'company_admin' ELSE 'collaborator' END,
 organization_id=CASE WHEN id='20000000-0000-4000-8000-000000000001' THEN '10000000-0000-4000-8000-000000000001'::uuid WHEN id='20000000-0000-4000-8000-000000000002' THEN '10000000-0000-4000-8000-000000000002'::uuid ELSE '10000000-0000-4000-8000-000000000003'::uuid END
 WHERE id IN ('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003');
INSERT INTO public.custom_catalog_items(code,description,unit_cost,organization_id,created_by) VALUES('CONTACT-PRIVATE','Private other tenant cost',32,'10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"aal":"aal2","role":"authenticated"}',true);
DO $$ BEGIN
 PERFORM public.tercis_request_chat_contact('contact-peer@example.test');
 IF tercis_messaging.can_contact('20000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Unaccepted request granted chat';END IF;
 BEGIN PERFORM public.tercis_respond_chat_contact((SELECT id FROM public.tercis_chat_contact_requests()),'accept');RAISE EXCEPTION 'Requester accepted own request';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000003',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.tercis_chat_contact_requests()) OR EXISTS(SELECT 1 FROM public.tercis_contact_links) THEN RAISE EXCEPTION 'Third party saw contact request';END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
DO $$ BEGIN
 PERFORM public.tercis_respond_chat_contact((SELECT id FROM public.tercis_chat_contact_requests()),'accept');
 IF NOT tercis_messaging.can_contact('20000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Accepted peer could not chat';END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
DO $$ BEGIN
 IF NOT tercis_messaging.can_contact('20000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Accepted requester could not chat';END IF;
 PERFORM public.tercis_send_direct_message('20000000-0000-4000-8000-000000000002','Consensual contact chat');
 IF EXISTS(SELECT 1 FROM public.custom_catalog_items WHERE code='CONTACT-PRIVATE') THEN RAISE EXCEPTION 'Chat contact granted purchase data';END IF;
 PERFORM public.tercis_respond_chat_contact((SELECT id FROM public.tercis_chat_contact_requests()),'revoke');
 IF tercis_messaging.can_contact('20000000-0000-4000-8000-000000000002') OR EXISTS(SELECT 1 FROM public.tercis_direct_messages WHERE body='Consensual contact chat') THEN RAISE EXCEPTION 'Revocation did not remove chat access';END IF;
END $$;
SELECT 'Personal contact consent, no self acceptance, tenant privacy and revocation: passed' AS verification;
ROLLBACK;
