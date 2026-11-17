-- Server-side budget search uses the caller's RLS privileges (SECURITY
-- INVOKER) and never exposes internal quotes to customer roles.
-- Stable ordering by created_at DESC, id DESC; page limit capped at 100.
CREATE OR REPLACE FUNCTION public.tercis_budget_search_ids(
  p_query text DEFAULT '', p_status text DEFAULT '',
  p_archived boolean DEFAULT false, p_page integer DEFAULT 0,
  p_page_size integer DEFAULT 100
)
RETURNS TABLE(id uuid,total bigint)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path=public,pg_temp AS $$
DECLARE v_query text:=left(btrim(coalesce(p_query,'')),100);
DECLARE v_status text:=coalesce(p_status,'');
DECLARE v_limit integer:=greatest(1,least(coalesce(p_page_size,100),100));
BEGIN
  IF NOT public.tercis_is_internal_staff() THEN
    RAISE EXCEPTION 'Consulta de orçamentos reservada a membros internos.'
      USING ERRCODE='42501';
  END IF;
  IF p_page IS NULL OR p_page<0 OR p_page>100000 THEN
    RAISE EXCEPTION 'Página de pesquisa inválida.' USING ERRCODE='22023';
  END IF;
  RETURN QUERY
    SELECT b.id,count(*) OVER() AS total
    FROM public.budgets b
    LEFT JOIN public.companies c
      ON c.id=b.company_id AND c.organization_id=b.organization_id
    WHERE (b.archived_at IS NOT NULL)=coalesce(p_archived,false)
      AND (v_status='' OR b.status=v_status)
      AND (v_query='' OR b.ref ILIKE '%'||v_query||'%'
        OR b.name ILIKE '%'||v_query||'%'
        OR b.sector ILIKE '%'||v_query||'%'
        OR c.name ILIKE '%'||v_query||'%')
    ORDER BY b.created_at DESC,b.id DESC
    LIMIT v_limit OFFSET p_page*v_limit;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_budget_search_ids(text,text,boolean,integer,integer)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_budget_search_ids(text,text,boolean,integer,integer)
  TO authenticated;

CREATE INDEX IF NOT EXISTS tercis_budgets_tenant_archive_sort
  ON public.budgets(organization_id,archived_at,created_at DESC,id DESC);
