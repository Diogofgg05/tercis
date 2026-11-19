CREATE TABLE public.tercis_contact_links(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 requester_id uuid NOT NULL REFERENCES public.profiles(id),
 recipient_id uuid NOT NULL REFERENCES public.profiles(id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','revoked')),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(requester_id<>recipient_id)
);
CREATE UNIQUE INDEX tercis_one_active_contact_pair ON public.tercis_contact_links(least(requester_id,recipient_id),greatest(requester_id,recipient_id)) WHERE status IN ('pending','accepted');
CREATE INDEX tercis_contact_recipient ON public.tercis_contact_links(recipient_id,status);
ALTER TABLE public.tercis_contact_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tercis_contact_links FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.tercis_contact_links TO authenticated;

CREATE FUNCTION tercis_messaging.can_use_chat() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.active AND p.organization_id IS NOT NULL
 AND p.role<>'app_admin' AND (p.role NOT IN ('admin','company_admin') OR public.tercis_verified_aal2()));
$$;
REVOKE ALL ON FUNCTION tercis_messaging.can_use_chat() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION tercis_messaging.can_use_chat() TO authenticated;
CREATE POLICY "Participants see contact requests" ON public.tercis_contact_links FOR SELECT TO authenticated
 USING(auth.uid() IN (requester_id,recipient_id) AND tercis_messaging.can_use_chat());

CREATE OR REPLACE FUNCTION tercis_messaging.can_contact(peer uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(
 SELECT 1 FROM public.profiles a JOIN public.profiles b ON b.id=peer
 WHERE a.id=auth.uid() AND a.id<>b.id AND a.active AND b.active
 AND a.organization_id IS NOT NULL AND b.organization_id IS NOT NULL AND a.role<>'app_admin' AND b.role<>'app_admin'
 AND (a.role NOT IN ('admin','company_admin') OR public.tercis_verified_aal2())
 AND ((a.organization_id=b.organization_id AND ((a.role<>'client' AND a.collaborator_type<>'client') OR (b.role<>'client' AND b.collaborator_type<>'client') OR (a.company_id IS NOT NULL AND a.company_id=b.company_id)))
 OR (a.role<>'client' AND a.collaborator_type<>'client' AND b.role<>'client' AND b.collaborator_type<>'client'
 AND (EXISTS(SELECT 1 FROM public.tercis_business_links l WHERE l.accepted_at IS NOT NULL AND l.revoked_at IS NULL
 AND ((l.owning_organization_id=a.organization_id AND l.partner_organization_id=b.organization_id) OR (l.partner_organization_id=a.organization_id AND l.owning_organization_id=b.organization_id)))
 OR EXISTS(SELECT 1 FROM public.tercis_contact_links l WHERE l.status='accepted' AND ((l.requester_id=a.id AND l.recipient_id=b.id) OR (l.recipient_id=a.id AND l.requester_id=b.id)))))));
$$;

CREATE FUNCTION public.tercis_request_chat_contact(p_email text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor public.profiles%ROWTYPE;peer public.profiles%ROWTYPE;link uuid;
BEGIN
 SELECT * INTO actor FROM public.profiles WHERE id=auth.uid();
 IF NOT tercis_messaging.can_use_chat() OR actor.role NOT IN ('admin','company_admin') THEN
  RAISE EXCEPTION 'Apenas a administração da empresa pode adicionar contactos externos.' USING ERRCODE='42501';END IF;
 SELECT * INTO peer FROM public.profiles WHERE lower(email)=lower(trim(p_email)) AND active AND organization_id IS NOT NULL AND role NOT IN ('client','app_admin') AND collaborator_type<>'client';
 IF NOT FOUND OR peer.organization_id=actor.organization_id THEN RAISE EXCEPTION 'Indica o email de uma conta ativa de outra empresa. Os teus colegas já aparecem no chat.' USING ERRCODE='22023';END IF;
 IF tercis_messaging.can_contact(peer.id) THEN RAISE EXCEPTION 'Esta pessoa já está nos teus contactos.' USING ERRCODE='22023';END IF;
 SELECT id INTO link FROM public.tercis_contact_links WHERE least(requester_id,recipient_id)=least(actor.id,peer.id) AND greatest(requester_id,recipient_id)=greatest(actor.id,peer.id) AND status='pending';
 IF link IS NOT NULL THEN RETURN link;END IF;
 INSERT INTO public.tercis_contact_links(requester_id,recipient_id) VALUES(actor.id,peer.id) RETURNING id INTO link;
 INSERT INTO public.audit_logs(organization_id,actor_id,entity_type,entity_id,action) VALUES(actor.organization_id,actor.id,'chat_contact',link,'contact_requested');
 RETURN link;
END $$;

CREATE FUNCTION public.tercis_chat_contact_requests()
RETURNS TABLE(id uuid,direction text,status text,full_name text,organization_name text,created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT tercis_messaging.can_use_chat() THEN RAISE EXCEPTION 'Chat indisponível.' USING ERRCODE='42501';END IF;
 RETURN QUERY SELECT l.id,CASE WHEN l.recipient_id=auth.uid() THEN 'incoming' ELSE 'outgoing' END,l.status,p.full_name,o.name,l.created_at
 FROM public.tercis_contact_links l JOIN public.profiles p ON p.id=CASE WHEN l.recipient_id=auth.uid() THEN l.requester_id ELSE l.recipient_id END
 JOIN public.organizations o ON o.id=p.organization_id WHERE auth.uid() IN (l.requester_id,l.recipient_id) AND l.status IN ('pending','accepted')
 ORDER BY l.created_at DESC LIMIT 100;
END $$;

CREATE FUNCTION public.tercis_respond_chat_contact(p_id uuid,p_action text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE link public.tercis_contact_links%ROWTYPE;new_status text;
BEGIN
 IF NOT tercis_messaging.can_use_chat() THEN RAISE EXCEPTION 'Chat indisponível.' USING ERRCODE='42501';END IF;
 SELECT * INTO link FROM public.tercis_contact_links WHERE id=p_id AND auth.uid() IN (requester_id,recipient_id) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Contacto indisponível.' USING ERRCODE='42501';END IF;
 IF p_action IN ('accept','decline') AND link.recipient_id=auth.uid() AND link.status='pending' THEN
  new_status:=CASE WHEN p_action='accept' THEN 'accepted' ELSE 'declined' END;
 ELSIF p_action='revoke' AND link.status IN ('pending','accepted') THEN new_status:='revoked';
 ELSE RAISE EXCEPTION 'Não podes alterar este pedido.' USING ERRCODE='42501';END IF;
 UPDATE public.tercis_contact_links SET status=new_status,updated_at=now() WHERE id=p_id;
 INSERT INTO public.audit_logs(organization_id,actor_id,entity_type,entity_id,action)
 VALUES(public.tercis_current_organization_id(),auth.uid(),'chat_contact',p_id,'contact_'||new_status);
END $$;
REVOKE ALL ON FUNCTION public.tercis_request_chat_contact(text),public.tercis_chat_contact_requests(),public.tercis_respond_chat_contact(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_request_chat_contact(text),public.tercis_chat_contact_requests(),public.tercis_respond_chat_contact(uuid,text) TO authenticated;
