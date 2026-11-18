-- Full dashboard KPI aggregation on the SERVER; never infer totals from a
-- first page of 100 quote documents. SECURITY INVOKER preserves tenant RLS.
-- Quote values are estimates, not paid invoices.
CREATE OR REPLACE FUNCTION public.tercis_dashboard_kpis()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path=public,pg_temp AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT public.tercis_is_internal_staff() THEN
    RAISE EXCEPTION 'Estatísticas comerciais reservadas à equipa autorizada.'
      USING ERRCODE='42501';
  END IF;
  WITH priced AS (
    SELECT b.id,b.company_id,b.status,b.include_tax,b.tax_rate,
      COALESCE((
        SELECT sum(round(
          round(round(i.unit_cost * (1+i.margin/100),4) *
            (1-i.discount/100),4) * i.quantity,2
        ))
        FROM public.budget_items i WHERE i.budget_id=b.id
      ),0)::numeric AS net
    FROM public.budgets b WHERE b.archived_at IS NULL
  ), totals AS (
    SELECT count(*) AS quote_count,
      count(*) FILTER(WHERE status IN
        ('rascunho','pendente_aprovacao','em_analise_tecnica','pedido_alteracoes')
      ) AS pending_count,
      count(*) FILTER(WHERE status IN ('aprovado','aceite','concluido')
      ) AS approved_count,
      count(DISTINCT company_id) AS client_count,
      round(COALESCE(sum(net+CASE WHEN include_tax
        THEN round(net*tax_rate/100,2) ELSE 0 END),0),2) AS quote_volume
    FROM priced
  )
  SELECT jsonb_build_object(
    'quote_count',t.quote_count,
    'pending_count',t.pending_count,
    'approved_count',t.approved_count,
    'client_count',t.client_count,
    'quote_volume',t.quote_volume,
    'companies_count',(SELECT count(*) FROM public.companies c WHERE c.active IS TRUE)
  ) INTO v_result FROM totals t;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_dashboard_kpis()
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_dashboard_kpis() TO authenticated;
