-- Scoped fixtures only; no real invitations or accounts survive this test.
BEGIN;
INSERT INTO public.organizations(id,slug,name) VALUES
 ('10000000-0000-4000-8000-000000000001','invite-directory-a','Directory A'),
 ('10000000-0000-4000-8000-000000000002','invite-directory-b','Directory B');
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('20000000-0000-4000-8000-000000000001','directory-admin@example.test','{}'),
 ('20000000-0000-4000-8000-000000000002','directory-peer@example.test','{}');
UPDATE public.profiles SET active=true,organization_id='10000000-0000-4000-8000-000000000001',role=CASE WHEN id='20000000-0000-4000-8000-000000000001' THEN 'company_admin' ELSE 'collaborator' END
 WHERE id IN ('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002');
INSERT INTO public.organization_invites(organization_id,email,invited_by) VALUES
 ('10000000-0000-4000-8000-000000000002','private@example.test','20000000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"aal":"aal2","role":"authenticated","sub":"20000000-0000-4000-8000-000000000001"}',true);
DO $$ DECLARE token uuid;entry jsonb; BEGIN
 token:=public.tercis_create_named_team_invite('new-person@example.test','New Person');
 SELECT to_jsonb(d) INTO entry FROM public.tercis_team_invitation_directory() d;
 IF entry->>'email'<>'new-person@example.test' OR entry->>'recipient_name'<>'New Person' OR entry->>'status'<>'pending' THEN RAISE EXCEPTION 'Named invite absent'; END IF;
 IF (SELECT count(*) FROM public.tercis_team_invitation_directory())<>1 THEN RAISE EXCEPTION 'Cross-tenant directory leak'; END IF;
 IF entry ? 'id' OR entry ? 'token' OR entry::text LIKE '%'||token::text||'%' THEN RAISE EXCEPTION 'Directory disclosed a redemption capability'; END IF;
END $$;
SELECT set_config('request.jwt.claims','{"aal":"aal1","role":"authenticated","sub":"20000000-0000-4000-8000-000000000001"}',true);
DO $$ BEGIN
 BEGIN PERFORM public.tercis_team_invitation_directory();RAISE EXCEPTION 'AAL1 admin read invitations';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.tercis_create_named_team_invite('denied@example.test','Denied');RAISE EXCEPTION 'AAL1 admin issued invite';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"aal":"aal2","role":"authenticated","sub":"20000000-0000-4000-8000-000000000002"}',true);
DO $$ BEGIN
 BEGIN PERFORM public.tercis_team_invitation_directory();RAISE EXCEPTION 'Collaborator read invitations';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.tercis_create_named_team_invite('denied@example.test','Denied');RAISE EXCEPTION 'Collaborator issued invite';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
SELECT 'Named invites, tenant isolation, token privacy and MFA: passed' AS verification;
ROLLBACK;
