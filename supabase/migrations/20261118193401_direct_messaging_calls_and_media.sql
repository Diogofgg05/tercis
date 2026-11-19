-- Direct conversations never inherit access to budgets or another tenant's data.
-- A revoked business link immediately removes directory, message, file and call access.
CREATE SCHEMA IF NOT EXISTS tercis_messaging;
REVOKE ALL ON SCHEMA tercis_messaging FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA tercis_messaging TO authenticated;

CREATE FUNCTION tercis_messaging.can_contact(peer uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS (
  SELECT 1 FROM public.profiles a JOIN public.profiles b ON b.id=peer
  WHERE a.id=auth.uid() AND a.id<>b.id AND a.active IS TRUE AND b.active IS TRUE
   AND a.organization_id IS NOT NULL AND b.organization_id IS NOT NULL
   AND a.role<>'app_admin' AND b.role<>'app_admin'
   AND (a.role NOT IN ('admin','company_admin') OR public.tercis_verified_aal2())
   AND (
    (a.organization_id=b.organization_id AND (
      (a.role<>'client' AND a.collaborator_type<>'client')
      OR (b.role<>'client' AND b.collaborator_type<>'client')
      OR (a.company_id IS NOT NULL AND a.company_id=b.company_id)))
    OR (a.role<>'client' AND a.collaborator_type<>'client'
      AND b.role<>'client' AND b.collaborator_type<>'client'
      AND EXISTS (SELECT 1 FROM public.tercis_business_links l
       WHERE l.accepted_at IS NOT NULL AND l.revoked_at IS NULL
        AND ((l.owning_organization_id=a.organization_id AND l.partner_organization_id=b.organization_id)
         OR (l.partner_organization_id=a.organization_id AND l.owning_organization_id=b.organization_id))))
   )
 );
$$;
REVOKE ALL ON FUNCTION tercis_messaging.can_contact(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION tercis_messaging.can_contact(uuid) TO authenticated;

CREATE FUNCTION public.tercis_chat_contacts()
RETURNS TABLE(id uuid,full_name text,job_title text,organization_name text,external boolean,avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p.id,p.full_name,p.job_title,o.name,
  p.organization_id IS DISTINCT FROM public.tercis_current_organization_id(),p.avatar_url
 FROM public.profiles p JOIN public.organizations o ON o.id=p.organization_id
 WHERE tercis_messaging.can_contact(p.id)
 ORDER BY p.organization_id IS DISTINCT FROM public.tercis_current_organization_id(),p.full_name;
$$;
REVOKE ALL ON FUNCTION public.tercis_chat_contacts() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_chat_contacts() TO authenticated;

CREATE TABLE public.tercis_direct_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 sender_id uuid NOT NULL REFERENCES public.profiles(id),
 recipient_id uuid NOT NULL REFERENCES public.profiles(id),
 body text NOT NULL DEFAULT '' CHECK(length(body)<=4000),
 attachment_path text, attachment_name text, attachment_type text,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(sender_id<>recipient_id),
 CHECK(length(trim(body))>0 OR attachment_path IS NOT NULL)
);
CREATE INDEX tercis_dm_recipient_time ON public.tercis_direct_messages(recipient_id,created_at DESC);
CREATE INDEX tercis_dm_sender_time ON public.tercis_direct_messages(sender_id,created_at DESC);
ALTER TABLE public.tercis_direct_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tercis_direct_messages FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.tercis_direct_messages TO authenticated;
CREATE POLICY "Participants read authorized direct messages" ON public.tercis_direct_messages
 FOR SELECT TO authenticated USING (
 (sender_id=auth.uid() AND tercis_messaging.can_contact(recipient_id))
 OR (recipient_id=auth.uid() AND tercis_messaging.can_contact(sender_id)));

CREATE FUNCTION public.tercis_send_direct_message(p_recipient uuid,p_body text,
 p_attachment_path text DEFAULT NULL,p_attachment_name text DEFAULT NULL,p_attachment_type text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT tercis_messaging.can_contact(p_recipient) THEN
  RAISE EXCEPTION 'Esta pessoa não está disponível para conversar.' USING ERRCODE='42501';
 END IF;
 IF p_attachment_path IS NOT NULL AND (
   split_part(p_attachment_path,'/',1)<>auth.uid()::text
   OR split_part(p_attachment_path,'/',2)<>p_recipient::text
   OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='tercis-chat-files' AND name=p_attachment_path)
   OR p_attachment_type IS NULL OR p_attachment_type NOT IN ('application/pdf','image/png','image/jpeg','image/webp','text/plain')
   OR p_attachment_name IS NULL OR length(p_attachment_name)>255
 ) THEN RAISE EXCEPTION 'Anexo inválido ou não enviado.' USING ERRCODE='22023'; END IF;
 INSERT INTO public.tercis_direct_messages(sender_id,recipient_id,body,attachment_path,attachment_name,attachment_type)
 VALUES(auth.uid(),p_recipient,coalesce(trim(p_body),''),p_attachment_path,p_attachment_name,p_attachment_type)
 RETURNING id INTO v_id;
 RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_send_direct_message(uuid,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_send_direct_message(uuid,text,text,text,text) TO authenticated;

CREATE TABLE public.tercis_calls (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 caller_id uuid NOT NULL REFERENCES public.profiles(id),
 callee_id uuid NOT NULL REFERENCES public.profiles(id),
 kind text NOT NULL CHECK(kind IN ('audio','video')),
 status text NOT NULL DEFAULT 'ringing' CHECK(status IN ('ringing','accepted','declined','ended')),
 offer jsonb NOT NULL CHECK(octet_length(offer::text)<100000),
 answer jsonb CHECK(octet_length(answer::text)<100000),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(caller_id<>callee_id)
);
CREATE INDEX tercis_calls_caller_time ON public.tercis_calls(caller_id,created_at DESC);
CREATE INDEX tercis_calls_callee_time ON public.tercis_calls(callee_id,created_at DESC);
ALTER TABLE public.tercis_calls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tercis_calls FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.tercis_calls TO authenticated;
CREATE POLICY "Participants read authorized calls" ON public.tercis_calls
 FOR SELECT TO authenticated USING (
 (caller_id=auth.uid() AND tercis_messaging.can_contact(callee_id))
 OR (callee_id=auth.uid() AND tercis_messaging.can_contact(caller_id)));

CREATE FUNCTION public.tercis_start_call(p_peer uuid,p_kind text,p_offer jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT tercis_messaging.can_contact(p_peer) THEN
  RAISE EXCEPTION 'Esta pessoa não está disponível para chamadas.' USING ERRCODE='42501';
 END IF;
 -- Lock participants in a deterministic order, including simultaneous calls.
 PERFORM 1 FROM public.profiles WHERE id IN (auth.uid(),p_peer) ORDER BY id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.tercis_calls WHERE
   (caller_id IN (auth.uid(),p_peer) OR callee_id IN (auth.uid(),p_peer))
   AND ((status='ringing' AND created_at>now()-interval '60 seconds')
    OR (status='accepted' AND updated_at>now()-interval '60 seconds'))) THEN
   RAISE EXCEPTION 'Um dos participantes já está numa chamada.' USING ERRCODE='55000';
 END IF;
 IF p_offer->>'type' IS DISTINCT FROM 'offer' OR length(coalesce(p_offer->>'sdp',''))<10 THEN
  RAISE EXCEPTION 'Pedido de chamada inválido.' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.tercis_calls(caller_id,callee_id,kind,offer)
 VALUES(auth.uid(),p_peer,p_kind,p_offer) RETURNING id INTO v_id;
 RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_start_call(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_start_call(uuid,text,jsonb) TO authenticated;

CREATE FUNCTION public.tercis_update_call(p_id uuid,p_status text,p_answer jsonb DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_call public.tercis_calls%ROWTYPE; v_peer uuid;
BEGIN
 SELECT * INTO v_call FROM public.tercis_calls WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR auth.uid() IS NULL OR auth.uid() NOT IN (v_call.caller_id,v_call.callee_id) THEN
  RAISE EXCEPTION 'Chamada indisponível.' USING ERRCODE='42501';
 END IF;
 v_peer:=CASE WHEN auth.uid()=v_call.caller_id THEN v_call.callee_id ELSE v_call.caller_id END;
 -- Ending remains possible after revocation; accepting requires current consent.
 IF p_status='accepted' THEN
  IF auth.uid()<>v_call.callee_id OR v_call.status<>'ringing'
    OR v_call.created_at<now()-interval '60 seconds'
    OR NOT tercis_messaging.can_contact(v_peer)
    OR p_answer->>'type' IS DISTINCT FROM 'answer' OR length(coalesce(p_answer->>'sdp',''))<10 THEN
   RAISE EXCEPTION 'Não é possível aceitar esta chamada.' USING ERRCODE='42501';
  END IF;
 ELSIF p_status='declined' THEN
  IF auth.uid()<>v_call.callee_id OR v_call.status<>'ringing' THEN
   RAISE EXCEPTION 'Não é possível recusar esta chamada.' USING ERRCODE='42501';
  END IF;
 ELSIF p_status='ended' THEN
  IF v_call.status IN ('ended','declined') THEN RETURN; END IF;
 ELSE RAISE EXCEPTION 'Estado de chamada inválido.' USING ERRCODE='22023';
 END IF;
 UPDATE public.tercis_calls SET status=p_status,
  answer=CASE WHEN p_status='accepted' THEN p_answer ELSE answer END,updated_at=now() WHERE id=p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_update_call(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_update_call(uuid,text,jsonb) TO authenticated;

-- Heartbeats validate continuing consent and let disconnected calls expire.
CREATE FUNCTION public.tercis_call_heartbeat(p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE public.tercis_calls SET updated_at=now()
 WHERE id=p_id AND status='accepted'
  AND ((caller_id=auth.uid() AND tercis_messaging.can_contact(callee_id))
    OR (callee_id=auth.uid() AND tercis_messaging.can_contact(caller_id)));
 RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_call_heartbeat(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_call_heartbeat(uuid) TO authenticated;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('tercis-chat-files','tercis-chat-files',false,10485760,
 ARRAY['application/pdf','image/png','image/jpeg','image/webp','text/plain']),
 ('tercis-profile-media','tercis-profile-media',false,5242880,
 ARRAY['image/png','image/jpeg','image/webp']) ON CONFLICT(id) DO NOTHING;

CREATE FUNCTION tercis_messaging.can_read_file(path text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.tercis_direct_messages m
 WHERE m.attachment_path=path AND
 ((m.sender_id=auth.uid() AND tercis_messaging.can_contact(m.recipient_id))
 OR (m.recipient_id=auth.uid() AND tercis_messaging.can_contact(m.sender_id))));
$$;
REVOKE ALL ON FUNCTION tercis_messaging.can_read_file(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION tercis_messaging.can_read_file(text) TO authenticated;

CREATE POLICY "Upload direct chat attachments" ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='tercis-chat-files' AND split_part(name,'/',1)=auth.uid()::text
 AND CASE WHEN split_part(name,'/',2) ~ '^[0-9a-f-]{36}$'
 THEN tercis_messaging.can_contact(split_part(name,'/',2)::uuid) ELSE false END);
CREATE POLICY "Read direct chat attachments" ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='tercis-chat-files' AND
 (split_part(name,'/',1)=auth.uid()::text OR tercis_messaging.can_read_file(name)));
CREATE POLICY "Remove own unused chat uploads" ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='tercis-chat-files' AND split_part(name,'/',1)=auth.uid()::text
 AND NOT tercis_messaging.can_read_file(name));
CREATE POLICY "Upload own profile image" ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='tercis-profile-media' AND split_part(name,'/',1)=auth.uid()::text
 AND public.tercis_is_active());
CREATE POLICY "Read authorized profile images" ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='tercis-profile-media' AND
 (split_part(name,'/',1)=auth.uid()::text OR
 CASE WHEN split_part(name,'/',1) ~ '^[0-9a-f-]{36}$'
 THEN tercis_messaging.can_contact(split_part(name,'/',1)::uuid) ELSE false END));
CREATE POLICY "Remove own profile image" ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='tercis-profile-media' AND split_part(name,'/',1)=auth.uid()::text);

-- Postgres Changes applies each table's SELECT RLS before delivering events.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tercis_direct_messages,public.tercis_calls;
 END IF;
END $$;
