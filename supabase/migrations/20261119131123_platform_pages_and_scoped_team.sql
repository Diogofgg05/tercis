CREATE FUNCTION public.tercis_company_team() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor public.profiles%ROWTYPE;manager boolean;
BEGIN
 SELECT * INTO actor FROM public.profiles WHERE id=auth.uid() AND active;
 IF NOT FOUND OR actor.organization_id IS NULL OR actor.role NOT IN ('admin','company_admin','collaborator') OR actor.collaborator_type<>'internal' THEN RAISE EXCEPTION 'Empresa indisponível.' USING ERRCODE='42501';END IF;
 manager:=actor.role IN ('admin','company_admin');
 IF manager AND NOT public.tercis_verified_aal2() THEN RAISE EXCEPTION 'A gestão da equipa exige dois fatores.' USING ERRCODE='42501';END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'email',p.email,'full_name',p.full_name,'role',p.role,'active',p.active,
 'organization_id',p.organization_id,'company_id',p.company_id,'avatar_url',p.avatar_url,'phone',p.phone,'job_title',p.job_title,'department',p.department,'collaborator_type',p.collaborator_type) ORDER BY p.full_name,p.id)
 FROM public.profiles p WHERE p.organization_id=actor.organization_id AND p.role IN ('admin','company_admin','collaborator') AND p.collaborator_type='internal'
 AND (manager OR p.active) AND NOT EXISTS(SELECT 1 FROM tercis_platform.administrators a WHERE a.user_id=p.id)),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.tercis_company_team() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_company_team() TO authenticated;

CREATE FUNCTION public.tercis_platform_data_page(p_section text,p_organization_id uuid DEFAULT NULL,p_query text DEFAULT '',p_page integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;term text:=left(trim(coalesce(p_query,'')),100);offset_rows integer;
BEGIN
 IF NOT public.tercis_is_platform_admin() OR NOT public.tercis_verified_aal2() THEN RAISE EXCEPTION 'Acesso exclusivo à administração da plataforma com dois fatores.' USING ERRCODE='42501';END IF;
 IF p_page IS NULL OR p_page<0 OR p_page>100000 OR p_section NOT IN ('users','budgets','catalog','activity') THEN RAISE EXCEPTION 'Página inválida.' USING ERRCODE='22023';END IF;
 offset_rows:=p_page*30;
 IF p_section='users' THEN
  WITH records AS(SELECT p.id,p.full_name,p.email,CASE WHEN a.user_id IS NOT NULL THEN 'app_admin' ELSE p.role END AS role,p.active,p.created_at,p.organization_id,o.name AS organization_name
   FROM public.profiles p LEFT JOIN public.organizations o ON o.id=p.organization_id LEFT JOIN tercis_platform.administrators a ON a.user_id=p.id AND a.active
   WHERE (p_organization_id IS NULL OR p.organization_id=p_organization_id) AND (term='' OR p.full_name ILIKE '%'||term||'%' OR p.email ILIKE '%'||term||'%')),
  page AS(SELECT * FROM records ORDER BY created_at DESC,id LIMIT 30 OFFSET offset_rows)
  SELECT jsonb_build_object('total',(SELECT count(*) FROM records),'items',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM page p),'[]'::jsonb)) INTO result;
 ELSIF p_section='budgets' THEN
  WITH records AS(SELECT b.id,b.ref,b.name,b.status,b.created_at,b.organization_id,b.is_example,o.name AS organization_name
   FROM public.budgets b JOIN public.organizations o ON o.id=b.organization_id
   WHERE (p_organization_id IS NULL OR b.organization_id=p_organization_id) AND (term='' OR b.name ILIKE '%'||term||'%' OR b.ref ILIKE '%'||term||'%')),
  page AS(SELECT * FROM records ORDER BY created_at DESC,id LIMIT 30 OFFSET offset_rows)
  SELECT jsonb_build_object('total',(SELECT count(*) FROM records),'items',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM page p),'[]'::jsonb)) INTO result;
 ELSIF p_section='catalog' THEN
  WITH records AS(SELECT c.id,c.code,c.description,c.brand,c.category,c.unit_cost,c.price_pending,c.organization_id,o.name AS organization_name
   FROM public.custom_catalog_items c JOIN public.organizations o ON o.id=c.organization_id WHERE c.active
   AND (p_organization_id IS NULL OR c.organization_id=p_organization_id) AND (term='' OR c.code ILIKE '%'||term||'%' OR c.description ILIKE '%'||term||'%' OR c.brand ILIKE '%'||term||'%')),
  page AS(SELECT * FROM records ORDER BY code,id LIMIT 30 OFFSET offset_rows)
  SELECT jsonb_build_object('total',(SELECT count(*) FROM records),'items',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM page p),'[]'::jsonb)) INTO result;
 ELSE
  WITH records AS(SELECT l.id,l.action,l.entity_type,l.created_at,l.organization_id,p.full_name AS actor_name,o.name AS organization_name
   FROM public.audit_logs l LEFT JOIN public.profiles p ON p.id=l.actor_id LEFT JOIN public.organizations o ON o.id=l.organization_id
   WHERE (p_organization_id IS NULL OR l.organization_id=p_organization_id) AND (term='' OR l.action ILIKE '%'||term||'%' OR p.full_name ILIKE '%'||term||'%')),
  page AS(SELECT * FROM records ORDER BY created_at DESC,id LIMIT 30 OFFSET offset_rows)
  SELECT jsonb_build_object('total',(SELECT count(*) FROM records),'items',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM page p),'[]'::jsonb)) INTO result;
 END IF;
 RETURN result||jsonb_build_object('page',p_page,'page_size',30);
END $$;
REVOKE ALL ON FUNCTION public.tercis_platform_data_page(text,uuid,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_platform_data_page(text,uuid,text,integer) TO authenticated;
