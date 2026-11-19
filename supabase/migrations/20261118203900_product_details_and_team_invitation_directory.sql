ALTER TABLE public.custom_catalog_items
 ADD COLUMN image_url text NOT NULL DEFAULT '',
 ADD COLUMN image_caption text NOT NULL DEFAULT '',
 ADD COLUMN specifications jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(specifications)='object');
ALTER TABLE public.organization_invites ADD COLUMN recipient_name text NOT NULL DEFAULT '';

CREATE FUNCTION public.tercis_create_named_team_invite(p_email text,p_name text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 IF length(coalesce(p_name,''))>120 THEN RAISE EXCEPTION 'O nome não pode exceder 120 caracteres.' USING ERRCODE='22023'; END IF;
 -- Existing invitation function enforces active administrator, tenant and MFA.
 v_id:=public.tercis_create_organization_invite(p_email);
 UPDATE public.organization_invites SET recipient_name=trim(coalesce(p_name,'')) WHERE id=v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.tercis_create_named_team_invite(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_create_named_team_invite(text,text) TO authenticated;

CREATE FUNCTION public.tercis_team_invitation_directory()
RETURNS TABLE(email text,recipient_name text,created_at timestamptz,expires_at timestamptz,status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_org uuid;
BEGIN
 SELECT p.organization_id INTO v_org FROM public.profiles p
 WHERE p.id=auth.uid() AND p.active IS TRUE AND p.role IN ('admin','company_admin');
 IF v_org IS NULL OR NOT public.tercis_verified_aal2() THEN
  RAISE EXCEPTION 'Consulta reservada à administração da empresa com MFA.' USING ERRCODE='42501'; END IF;
 -- Never return a usable invitation token from a directory listing.
 RETURN QUERY SELECT i.email,i.recipient_name,i.created_at,i.expires_at,
  CASE WHEN i.revoked_at IS NOT NULL THEN 'revoked' WHEN i.used_at IS NOT NULL THEN 'accepted'
   WHEN i.expires_at<=now() THEN 'expired' ELSE 'pending' END
 FROM public.organization_invites i WHERE i.organization_id=v_org
 ORDER BY i.created_at DESC LIMIT 100;
END $$;
REVOKE ALL ON FUNCTION public.tercis_team_invitation_directory() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_team_invitation_directory() TO authenticated;

CREATE OR REPLACE FUNCTION public.tercis_catalog_page_v2(
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
  SELECT id,code,description,reference,brand,category,sector,unit,unit_cost,supplier,source_url,price_pending,image_url,image_caption,specifications
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
