-- Self-contained fixtures: every change is rolled back, including Auth users.
BEGIN;
INSERT INTO public.organizations(id,slug,name) VALUES
 ('10000000-0000-4000-8000-000000000001','chat-test-a','Chat A'),
 ('10000000-0000-4000-8000-000000000002','chat-test-b','Chat B'),
 ('10000000-0000-4000-8000-000000000003','chat-test-c','Chat C');
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('20000000-0000-4000-8000-000000000001','chat-a1@example.test','{"full_name":"A One"}'),
 ('20000000-0000-4000-8000-000000000002','chat-a2@example.test','{"full_name":"A Two"}'),
 ('20000000-0000-4000-8000-000000000003','chat-b@example.test','{"full_name":"B"}'),
 ('20000000-0000-4000-8000-000000000004','chat-c@example.test','{"full_name":"C"}');
UPDATE public.profiles SET active=true,role='collaborator',organization_id=CASE
 WHEN id IN ('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002') THEN '10000000-0000-4000-8000-000000000001'::uuid
 WHEN id='20000000-0000-4000-8000-000000000003' THEN '10000000-0000-4000-8000-000000000002'::uuid
 ELSE '10000000-0000-4000-8000-000000000003'::uuid END
WHERE id::text LIKE '20000000-0000-4000-8000-%';
INSERT INTO public.companies(id,name,organization_id,created_by) VALUES
 ('30000000-0000-4000-8000-000000000001','Partner B','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001');
UPDATE public.profiles SET company_id='30000000-0000-4000-8000-000000000001'
 WHERE id IN ('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002');
INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES
 ('tercis-company-media','10000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000001/logo.webp','20000000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"aal":"aal2","role":"authenticated","sub":"20000000-0000-4000-8000-000000000001"}',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.tercis_chat_contacts())<>1 THEN RAISE EXCEPTION 'Internal directory mismatch'; END IF;
 IF tercis_messaging.can_contact(auth.uid()) THEN RAISE EXCEPTION 'Self-contact allowed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='tercis-company-media' AND name LIKE '10000000-%') THEN RAISE EXCEPTION 'Own company logo not readable'; END IF;
 BEGIN
  INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('tercis-company-media','10000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000001/unauthorized.webp',auth.uid()::text);
  RAISE EXCEPTION 'Non-admin can upload company logos';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.tercis_send_direct_message('20000000-0000-4000-8000-000000000003','Should fail');
  RAISE EXCEPTION 'Unlinked tenant can receive messages';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM public.tercis_send_direct_message('20000000-0000-4000-8000-000000000002','Internal message');
 BEGIN
  INSERT INTO public.tercis_direct_messages(sender_id,recipient_id,body) VALUES(auth.uid(),'20000000-0000-4000-8000-000000000002','Spoof');
  RAISE EXCEPTION 'Direct message writes granted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
-- Storage metadata exists only inside this rollback; no bytes are uploaded.
INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES
 ('tercis-chat-files','20000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000002/test/document.txt','20000000-0000-4000-8000-000000000001'),
 ('tercis-profile-media','20000000-0000-4000-8000-000000000001/avatar.webp','20000000-0000-4000-8000-000000000001');
DO $$ BEGIN
 PERFORM public.tercis_send_direct_message('20000000-0000-4000-8000-000000000002','',
 '20000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000002/test/document.txt','document.txt','text/plain');
 BEGIN
  PERFORM public.tercis_send_direct_message('20000000-0000-4000-8000-000000000002','',
  '20000000-0000-4000-8000-000000000003/20000000-0000-4000-8000-000000000002/stolen.txt','stolen.txt','text/plain');
  RAISE EXCEPTION 'Other sender attachment accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"aal":"aal2","role":"authenticated","sub":"20000000-0000-4000-8000-000000000002"}',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM storage.objects WHERE bucket_id IN ('tercis-chat-files','tercis-profile-media') AND name LIKE '20000000-%')<>2 THEN
  RAISE EXCEPTION 'Recipient cannot read file or colleague avatar'; END IF;
 BEGIN
  INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('tercis-profile-media','20000000-0000-4000-8000-000000000001/forged.webp','20000000-0000-4000-8000-000000000002');
  RAISE EXCEPTION 'Uploading another user avatar was allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"aal":"aal2","role":"authenticated","sub":"20000000-0000-4000-8000-000000000001"}',true);
RESET ROLE;
INSERT INTO public.tercis_business_links(id,owning_organization_id,local_company_id,partner_organization_id,relationship_type,secret_hash,invited_by,accepted_by,accepted_at)
VALUES('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','supplier',repeat('a',64),'20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003',now());
SET LOCAL ROLE authenticated;
DO $$ DECLARE v_call_id uuid; BEGIN
 IF (SELECT count(*) FROM public.tercis_chat_contacts())<>2 THEN RAISE EXCEPTION 'Linked colleague missing'; END IF;
 PERFORM public.tercis_send_direct_message('20000000-0000-4000-8000-000000000003','Partner message');
 v_call_id:=public.tercis_start_call('20000000-0000-4000-8000-000000000003','video','{"type":"offer","sdp":"test-offer-description"}');
 PERFORM public.tercis_add_call_ice(v_call_id,'{"candidate":"candidate:fixture-one","sdpMid":"0","sdpMLineIndex":0}');
 PERFORM public.tercis_add_call_ice(v_call_id,'{"candidate":"candidate:fixture-one","sdpMid":"0","sdpMLineIndex":0}');
 IF (SELECT count(*) FROM public.tercis_call_ice c WHERE c.call_id=v_call_id)<>1 THEN RAISE EXCEPTION 'ICE duplicate was not ignored'; END IF;
 BEGIN
  PERFORM public.tercis_update_call(v_call_id,'accepted','{"type":"answer","sdp":"test-answer-description"}');
  RAISE EXCEPTION 'Caller accepted own offer';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.tercis_start_call('20000000-0000-4000-8000-000000000002','audio','{"type":"offer","sdp":"test-offer-description"}');
  RAISE EXCEPTION 'Concurrent call allowed';
 EXCEPTION WHEN object_not_in_prerequisite_state THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000003',true);
SELECT set_config('request.jwt.claims','{"aal":"aal2","role":"authenticated","sub":"20000000-0000-4000-8000-000000000003"}',true);
DO $$ DECLARE call_id uuid; BEGIN
 IF (SELECT count(*) FROM public.tercis_direct_messages)<>1 THEN RAISE EXCEPTION 'Partner can read internal message'; END IF;
 SELECT id INTO STRICT call_id FROM public.tercis_calls;
 IF (SELECT count(*) FROM public.tercis_call_ice)<>1 THEN RAISE EXCEPTION 'Callee cannot read remote ICE'; END IF;
 PERFORM public.tercis_update_call(call_id,'accepted','{"type":"answer","sdp":"test-answer-description"}');
 IF NOT public.tercis_call_heartbeat(call_id) THEN RAISE EXCEPTION 'Participant heartbeat denied'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000004',true);
SELECT set_config('request.jwt.claims','{"aal":"aal2","role":"authenticated","sub":"20000000-0000-4000-8000-000000000004"}',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.tercis_direct_messages) OR EXISTS(SELECT 1 FROM public.tercis_calls) THEN RAISE EXCEPTION 'Third party can read communication'; END IF;
 IF EXISTS(SELECT 1 FROM public.tercis_call_ice) THEN RAISE EXCEPTION 'Third party can read ICE candidates'; END IF;
 IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id IN ('tercis-chat-files','tercis-profile-media') AND name LIKE '20000000-%') THEN RAISE EXCEPTION 'Third party can read files'; END IF;
 IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='tercis-company-media' AND name LIKE '10000000-%') THEN RAISE EXCEPTION 'Third party can read company logos'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT set_config('request.jwt.claims','{}',true);
UPDATE public.tercis_business_links SET revoked_at=now() WHERE id='40000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000003',true);
SELECT set_config('request.jwt.claims','{"aal":"aal2","role":"authenticated","sub":"20000000-0000-4000-8000-000000000003"}',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.tercis_direct_messages) OR EXISTS(SELECT 1 FROM public.tercis_calls) THEN RAISE EXCEPTION 'Revocation did not remove access'; END IF;
 IF EXISTS(SELECT 1 FROM public.tercis_call_ice) THEN RAISE EXCEPTION 'Revoked contact can read ICE candidates'; END IF;
 IF EXISTS(SELECT 1 FROM public.tercis_chat_contacts()) THEN RAISE EXCEPTION 'Revoked contacts remain visible'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT set_config('request.jwt.claims','{}',true);
UPDATE public.profiles SET role='company_admin' WHERE id='20000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"aal":"aal2","role":"authenticated","sub":"20000000-0000-4000-8000-000000000001"}',true);
INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('tercis-company-media','10000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000001/admin-upload.webp',auth.uid()::text);
UPDATE public.companies SET logo_path='10000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000001/admin-upload.webp' WHERE id='30000000-0000-4000-8000-000000000001';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.companies WHERE id='30000000-0000-4000-8000-000000000001' AND logo_path LIKE '%admin-upload.webp') THEN RAISE EXCEPTION 'Company admin cannot save logo'; END IF;
END $$;
SELECT 'Direct messages, calls, files, avatars, company logos and revocation: passed' AS verification;
ROLLBACK;
