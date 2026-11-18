-- Stable, tenant-scoped keyset pagination.
-- Offset pagination can skip or repeat quotes when a concurrent user inserts
-- or removes a row ahead of the current page.
-- Leave the legacy RPC in place for backwards compatibility.
CREATE OR REPLACE FUNCTION public.tercis_budget_search_cursor(
  p_query text DEFAULT '',
  p_status text DEFAULT '',
  p_archived boolean DEFAULT false,
  p_after_created_at timestamptz DEFAULT NULL,
  p_after_id uuid DEFAULT NULL,
  p_page_size integer DEFAULT 100
)
RETURNS TABLE(id uuid, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = public, pg_temp AS $cursor$
DECLARE
  v_query text := left(btrim(coalesce(p_query,'')),100);
  v_status text := coalesce(p_status,'');
  v_limit integer := greatest(1,least(coalesce(p_page_size,100),100));
  v_org uuid;
BEGIN
  IF NOT public.tercis_is_internal_staff() THEN
    RAISE EXCEPTION 'Consulta de orçamentos reservada a membros internos.'
      USING ERRCODE = '42501';
  END IF;
  v_org := public.tercis_current_organization_id();
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Organização não confirmada.' USING ERRCODE = '42501';
  END IF;
  IF p_after_id IS NULL AND p_after_created_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cursor inválido: referência em falta.' USING ERRCODE = '22023';
  END IF;

  -- Return one extra record so the client can determine whether another
  -- page exists. The next cursor is taken from the *last displayed* record.
  RETURN QUERY
    SELECT b.id,b.created_at
    FROM public.budgets b
    LEFT JOIN public.companies c
      ON c.id=b.company_id AND c.organization_id=b.organization_id
    WHERE b.organization_id=v_org
      AND (b.archived_at IS NOT NULL)=coalesce(p_archived,false)
      AND (v_status='' OR b.status=v_status)
      AND (v_query='' OR b.ref ILIKE '%'||v_query||'%'
        OR b.name ILIKE '%'||v_query||'%'
        OR b.sector ILIKE '%'||v_query||'%'
        OR c.name ILIKE '%'||v_query||'%')
      AND (
        p_after_id IS NULL
        OR (
          p_after_created_at IS NOT NULL AND (
            b.created_at<p_after_created_at
            OR (b.created_at=p_after_created_at AND b.id<p_after_id)
            OR b.created_at IS NULL
          )
        )
        OR (
          p_after_created_at IS NULL AND b.created_at IS NULL
          AND b.id<p_after_id
        )
      )
    ORDER BY b.created_at DESC NULLS LAST,b.id DESC
    LIMIT v_limit+1;
END;
$cursor$;

REVOKE ALL ON FUNCTION public.tercis_budget_search_cursor(
  text,text,boolean,timestamptz,uuid,integer
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_budget_search_cursor(
  text,text,boolean,timestamptz,uuid,integer
) TO authenticated;

-- Matches tenant / archive filtering and the deterministic cursor sort.
CREATE INDEX IF NOT EXISTS tercis_budgets_tenant_cursor_sort
  ON public.budgets(organization_id,archived_at,created_at DESC NULLS LAST,id DESC);
