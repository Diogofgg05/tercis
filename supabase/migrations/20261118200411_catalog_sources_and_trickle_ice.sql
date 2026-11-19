ALTER TABLE public.custom_catalog_items
 ADD COLUMN source_url text NOT NULL DEFAULT '' CHECK(source_url='' OR source_url ~ '^https://'),
 ADD COLUMN price_pending boolean NOT NULL DEFAULT false;

CREATE FUNCTION public.tercis_catalog_page_v2(
 p_query text DEFAULT '',p_category text DEFAULT '',p_page integer DEFAULT 0,
 p_page_size integer DEFAULT 25,p_sector text DEFAULT '',p_brand text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_query text:=left(trim(coalesce(p_query,'')),80);v_limit integer;v_offset integer;v_result jsonb;
BEGIN
 IF NOT public.tercis_can_read_internal_catalog() THEN
  RAISE EXCEPTION 'Não pode consultar o catálogo interno.' USING ERRCODE='42501'; END IF;
 IF p_page IS NULL OR p_page<0 OR p_page>100000 THEN
  RAISE EXCEPTION 'Página inválida.' USING ERRCODE='22023'; END IF;
 v_limit:=greatest(1,least(coalesce(p_page_size,25),100));v_offset:=p_page*v_limit;
 WITH matched AS (
  SELECT id,code,description,reference,brand,category,sector,unit,unit_cost,supplier,source_url,price_pending
  FROM public.custom_catalog_items WHERE active IS TRUE
   AND (coalesce(p_category,'')='' OR category=p_category)
   AND (coalesce(p_sector,'')='' OR sector=p_sector)
   AND (coalesce(p_brand,'')='' OR brand=p_brand)
   AND (v_query='' OR code ILIKE '%'||v_query||'%' OR description ILIKE '%'||v_query||'%'
    OR reference ILIKE '%'||v_query||'%' OR brand ILIKE '%'||v_query||'%')
 ), paged AS (SELECT * FROM matched ORDER BY lower(code),id LIMIT v_limit OFFSET v_offset)
 SELECT jsonb_build_object('total',(SELECT count(*) FROM matched),'page',p_page,'page_size',v_limit,
 'items',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY lower(p.code),p.id) FROM paged p),'[]'::jsonb)) INTO v_result;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.tercis_catalog_page_v2(text,text,integer,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_catalog_page_v2(text,text,integer,integer,text,text) TO authenticated;

CREATE FUNCTION public.tercis_catalog_summary() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT public.tercis_can_read_internal_catalog() THEN
  RAISE EXCEPTION 'Não pode consultar o catálogo interno.' USING ERRCODE='42501'; END IF;
 RETURN (SELECT jsonb_build_object('total',count(*),'pending_prices',count(*) FILTER(WHERE price_pending),
 'verified_references',count(*) FILTER(WHERE source_url<>''),
 'brands',coalesce(jsonb_agg(DISTINCT brand) FILTER(WHERE brand<>''),'[]'::jsonb))
 FROM public.custom_catalog_items WHERE active IS TRUE);
END $$;
REVOKE ALL ON FUNCTION public.tercis_catalog_summary() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_catalog_summary() TO authenticated;

-- Trickle ICE removes the gathering delay before the recipient rings.
CREATE TABLE public.tercis_call_ice (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 call_id uuid NOT NULL REFERENCES public.tercis_calls(id) ON DELETE CASCADE,
 sender_id uuid NOT NULL REFERENCES public.profiles(id),
 candidate jsonb NOT NULL CHECK(jsonb_typeof(candidate)='object' AND octet_length(candidate::text)<10000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tercis_call_ice_session ON public.tercis_call_ice(call_id,sender_id,created_at);
ALTER TABLE public.tercis_call_ice ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tercis_call_ice FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.tercis_call_ice TO authenticated;
CREATE POLICY "Participants read ICE candidates" ON public.tercis_call_ice FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.tercis_calls c WHERE c.id=call_id));

CREATE FUNCTION public.tercis_add_call_ice(p_call_id uuid,p_candidate jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_call public.tercis_calls%ROWTYPE;v_peer uuid;
BEGIN
 SELECT * INTO v_call FROM public.tercis_calls WHERE id=p_call_id FOR UPDATE;
 IF NOT FOUND OR auth.uid() IS NULL OR auth.uid() NOT IN (v_call.caller_id,v_call.callee_id)
  OR v_call.status NOT IN ('ringing','accepted') THEN
  RAISE EXCEPTION 'Chamada indisponível.' USING ERRCODE='42501'; END IF;
 v_peer:=CASE WHEN auth.uid()=v_call.caller_id THEN v_call.callee_id ELSE v_call.caller_id END;
 IF NOT tercis_messaging.can_contact(v_peer) THEN
  RAISE EXCEPTION 'Contacto indisponível.' USING ERRCODE='42501'; END IF;
 IF p_candidate IS NULL OR jsonb_typeof(p_candidate)<>'object' OR length(coalesce(p_candidate->>'candidate',''))<5 THEN
  RAISE EXCEPTION 'Candidato de rede inválido.' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM public.tercis_call_ice WHERE call_id=p_call_id AND sender_id=auth.uid())>=128 THEN
  RAISE EXCEPTION 'Limite de candidatos de rede atingido.' USING ERRCODE='54000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.tercis_call_ice WHERE call_id=p_call_id AND sender_id=auth.uid() AND candidate=p_candidate) THEN
  INSERT INTO public.tercis_call_ice(call_id,sender_id,candidate) VALUES(p_call_id,auth.uid(),p_candidate);
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.tercis_add_call_ice(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_add_call_ice(uuid,jsonb) TO authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tercis_call_ice;
 END IF;
END $$;
