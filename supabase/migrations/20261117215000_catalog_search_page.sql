-- True server-side catalog filtering/pagination; parameterized ILIKE,
-- bounded request sizes, and SQL INVOKER to enforce tenant RLS/cost privacy.
CREATE OR REPLACE FUNCTION public.tercis_catalog_page(
  p_query text DEFAULT '',p_category text DEFAULT '',
  p_page integer DEFAULT 0,p_page_size integer DEFAULT 25,
  p_sector text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path=public,pg_temp AS $$
DECLARE v_query text:=left(btrim(coalesce(p_query,'')),80);
DECLARE v_category text:=btrim(coalesce(p_category,''));
DECLARE v_sector text:=btrim(coalesce(p_sector,''));
DECLARE v_offset integer; v_limit integer; v_result jsonb;
BEGIN
  IF NOT public.tercis_can_read_internal_catalog() THEN
    RAISE EXCEPTION 'Não pode consultar custos do catálogo.' USING ERRCODE='42501';
  END IF;
  v_limit:=greatest(1,least(coalesce(p_page_size,25),100));
  IF p_page IS NULL OR p_page<0 OR p_page>100000 THEN
    RAISE EXCEPTION 'Página fora dos limites.' USING ERRCODE='22023';
  END IF;
  v_offset:=p_page*v_limit;
  WITH matched AS (
    SELECT id,code,description,reference,brand,category,sector,unit,
      unit_cost,supplier
    FROM public.custom_catalog_items
    WHERE active IS TRUE
      AND (v_category='' OR category=v_category)
      AND (v_sector='' OR sector=v_sector)
      AND (v_query='' OR code ILIKE '%'||v_query||'%'
        OR description ILIKE '%'||v_query||'%'
        OR reference ILIKE '%'||v_query||'%'
        OR brand ILIKE '%'||v_query||'%')
  ), paged AS (
    SELECT * FROM matched ORDER BY lower(code),id
    LIMIT v_limit OFFSET v_offset
  )
  SELECT jsonb_build_object(
    'total',(SELECT count(*) FROM matched),
    'page',p_page,'page_size',v_limit,
    'items',coalesce(
      (SELECT jsonb_agg(to_jsonb(p) ORDER BY lower(p.code),p.id) FROM paged p),
      '[]'::jsonb
    )
  ) INTO v_result;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_catalog_page(text,text,integer,integer,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_catalog_page(text,text,integer,integer,text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.tercis_catalog_categories()
RETURNS SETOF text LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path=public,pg_temp AS $$
BEGIN
  IF NOT public.tercis_can_read_internal_catalog() THEN
    RAISE EXCEPTION 'Não pode consultar o catálogo.' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT DISTINCT c.category
  FROM public.custom_catalog_items c
  WHERE c.active IS TRUE AND c.category IS NOT NULL AND btrim(c.category)<>''
  ORDER BY c.category LIMIT 500;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_catalog_categories()
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_catalog_categories() TO authenticated;

CREATE INDEX IF NOT EXISTS tercis_catalog_org_sort_page
 ON public.custom_catalog_items(organization_id,active,lower(code),id);
