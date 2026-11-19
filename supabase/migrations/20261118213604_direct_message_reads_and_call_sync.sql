ALTER TABLE public.tercis_direct_messages ADD COLUMN read_at timestamptz;

-- Clients can only acknowledge received messages actually displayed by their UI.
-- Direct table writes remain revoked; neither sender nor another tenant can forge a receipt.
CREATE FUNCTION public.tercis_mark_direct_messages_read(p_peer uuid,p_message_ids uuid[])
RETURNS TABLE(id uuid,read_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT tercis_messaging.can_contact(p_peer) THEN
  RAISE EXCEPTION 'Conversa indisponível.' USING ERRCODE='42501'; END IF;
 IF p_message_ids IS NULL OR cardinality(p_message_ids)>100 THEN
  RAISE EXCEPTION 'Lista de mensagens inválida.' USING ERRCODE='22023'; END IF;
 UPDATE public.tercis_direct_messages m SET read_at=now()
 WHERE m.recipient_id=auth.uid() AND m.sender_id=p_peer AND m.id=ANY(p_message_ids) AND m.read_at IS NULL;
 RETURN QUERY SELECT m.id,m.read_at FROM public.tercis_direct_messages m
 WHERE m.recipient_id=auth.uid() AND m.sender_id=p_peer AND m.id=ANY(p_message_ids);
END $$;
REVOKE ALL ON FUNCTION public.tercis_mark_direct_messages_read(uuid,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_mark_direct_messages_read(uuid,uuid[]) TO authenticated;

-- Repair publication membership without assuming an empty publication.
DO $$ DECLARE item text; BEGIN
 IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
  FOREACH item IN ARRAY ARRAY['tercis_calls','tercis_call_ice','tercis_direct_messages'] LOOP
   IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=item) THEN
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',item);
   END IF;
  END LOOP;
 END IF;
END $$;
