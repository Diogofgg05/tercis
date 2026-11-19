-- Complete quote export is scoped to the authenticated tenant.
-- Do not silently export only the first page visible in the browser.
-- Hard cap avoids unbounded JSON responses; >5000 is an explicit error.
CREATE OR REPLACE FUNCTION public.tercis_export_budget_csv_rows(
  p_query text DEFAULT '',p_status text DEFAULT '',
  p_archived boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path=public,pg_temp AS $$
DECLARE v_result jsonb; v_count bigint;
DECLARE v_query text:=left(btrim(coalesce(p_query,'')),100);
DECLARE v_status text:=coalesce(p_status,'');
BEGIN
  IF NOT public.tercis_is_internal_staff() THEN
    RAISE EXCEPTION 'Exportação de orçamentos reservada à equipa interna.'
      USING ERRCODE='42501';
  END IF;
  SELECT count(*) INTO v_count
  FROM public.budgets b
  LEFT JOIN public.companies c ON c.id=b.company_id
    AND c.organization_id=b.organization_id
  WHERE (b.archived_at IS NOT NULL)=coalesce(p_archived,false)
    AND (v_status='' OR b.status=v_status)
    AND (v_query='' OR b.ref ILIKE '%'||v_query||'%'
      OR b.name ILIKE '%'||v_query||'%'
      OR b.sector ILIKE '%'||v_query||'%'
      OR c.name ILIKE '%'||v_query||'%');
  IF v_count>5000 THEN
    RAISE EXCEPTION 'A exportação excede 5000 propostas. Aplique filtros mais específicos.'
      USING ERRCODE='22023';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'ref',q.ref,'name',q.name,'company',q.company,
    'status',q.status,'date',q.date,'valid_until',q.valid_until,
    'amount',q.amount
  ) ORDER BY q.created_at DESC,q.id DESC),'[]'::jsonb) INTO v_result
  FROM (
    SELECT b.id,b.ref,b.name,c.name AS company,b.status,b.date,
      b.valid_until,b.created_at,
      round(net.net_amount + CASE WHEN b.include_tax
        THEN round(net.net_amount * coalesce(b.tax_rate,0)/100,2)
        ELSE 0 END,2) AS amount
    FROM public.budgets b
    LEFT JOIN public.companies c ON c.id=b.company_id
      AND c.organization_id=b.organization_id
    CROSS JOIN LATERAL (
      SELECT coalesce(sum(round(
        round(round(coalesce(i.unit_cost,0)*(1+coalesce(i.margin,0)/100),4)
          *(1-coalesce(i.discount,0)/100),4)*coalesce(i.quantity,0),2)
      ),0)::numeric AS net_amount
      FROM public.budget_items i WHERE i.budget_id=b.id
    ) net
    WHERE (b.archived_at IS NOT NULL)=coalesce(p_archived,false)
      AND (v_status='' OR b.status=v_status)
      AND (v_query='' OR b.ref ILIKE '%'||v_query||'%'
        OR b.name ILIKE '%'||v_query||'%'
        OR b.sector ILIKE '%'||v_query||'%'
        OR c.name ILIKE '%'||v_query||'%')
    ORDER BY b.created_at DESC,b.id DESC LIMIT 5000
  ) q;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_export_budget_csv_rows(text,text,boolean)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_export_budget_csv_rows(text,text,boolean)
  TO authenticated;
