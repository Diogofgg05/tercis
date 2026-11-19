BEGIN;
INSERT INTO public.organizations(id,slug,name) VALUES
 ('10000000-0000-4000-8000-000000000001','receipt-test-a','Receipt A'),
 ('10000000-0000-4000-8000-000000000002','receipt-test-b','Receipt B');
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('20000000-0000-4000-8000-000000000001','receipt-a@example.test','{}'),
 ('20000000-0000-4000-8000-000000000002','receipt-b@example.test','{}'),
 ('20000000-0000-4000-8000-000000000003','receipt-other@example.test','{}');
UPDATE public.profiles SET active=true,role='collaborator',organization_id=CASE WHEN id='20000000-0000-4000-8000-000000000003' THEN '10000000-0000-4000-8000-000000000002'::uuid ELSE '10000000-0000-4000-8000-000000000001'::uuid END
 WHERE id IN ('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003');
INSERT INTO public.tercis_direct_messages(id,sender_id,recipient_id,body) VALUES
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','Displayed'),
 ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','Not displayed');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"aal":"aal1","role":"authenticated","sub":"20000000-0000-4000-8000-000000000001"}',true);
DO $$ DECLARE touched integer; BEGIN
 IF EXISTS(SELECT 1 FROM public.tercis_mark_direct_messages_read('20000000-0000-4000-8000-000000000002',ARRAY['30000000-0000-4000-8000-000000000001'::uuid])) THEN RAISE EXCEPTION 'Sender forged read receipt'; END IF;
 BEGIN UPDATE public.tercis_direct_messages SET read_at=now();GET DIAGNOSTICS touched=ROW_COUNT;IF touched>0 THEN RAISE EXCEPTION 'Direct update changed messages';END IF;EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000003',true);
SELECT set_config('request.jwt.claims','{"aal":"aal1","role":"authenticated","sub":"20000000-0000-4000-8000-000000000003"}',true);
DO $$ BEGIN
 BEGIN PERFORM public.tercis_mark_direct_messages_read('20000000-0000-4000-8000-000000000001',ARRAY['30000000-0000-4000-8000-000000000001'::uuid]);RAISE EXCEPTION 'Other tenant forged receipt';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"aal":"aal1","role":"authenticated","sub":"20000000-0000-4000-8000-000000000002"}',true);
DO $$ DECLARE first_read timestamptz;second_read timestamptz; BEGIN
 SELECT read_at INTO first_read FROM public.tercis_mark_direct_messages_read('20000000-0000-4000-8000-000000000001',ARRAY['30000000-0000-4000-8000-000000000001'::uuid]);
 IF first_read IS NULL THEN RAISE EXCEPTION 'Recipient failed to acknowledge';END IF;
 SELECT read_at INTO second_read FROM public.tercis_mark_direct_messages_read('20000000-0000-4000-8000-000000000001',ARRAY['30000000-0000-4000-8000-000000000001'::uuid]);
 IF first_read IS DISTINCT FROM second_read THEN RAISE EXCEPTION 'Receipt timestamp changed';END IF;
 IF EXISTS(SELECT 1 FROM public.tercis_direct_messages WHERE id='30000000-0000-4000-8000-000000000002' AND read_at IS NOT NULL) THEN RAISE EXCEPTION 'Unseen message marked read';END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"aal":"aal1","role":"authenticated","sub":"20000000-0000-4000-8000-000000000001"}',true);
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.tercis_direct_messages WHERE id='30000000-0000-4000-8000-000000000001' AND read_at IS NOT NULL) THEN RAISE EXCEPTION 'Sender cannot read acknowledgment';END IF;END $$;
SELECT 'Recipient-only, idempotent, visible-message read receipts: passed' AS verification;
ROLLBACK;
