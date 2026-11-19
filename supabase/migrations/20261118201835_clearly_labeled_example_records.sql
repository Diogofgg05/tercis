ALTER TABLE public.companies ADD COLUMN is_example boolean NOT NULL DEFAULT false;
ALTER TABLE public.budgets ADD COLUMN is_example boolean NOT NULL DEFAULT false;

CREATE FUNCTION public.tercis_guard_example_budget() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $guard$
BEGIN
 IF TG_OP='UPDATE' AND NEW.is_example IS DISTINCT FROM OLD.is_example AND auth.uid() IS NOT NULL THEN
  RAISE EXCEPTION 'A classificação de demonstração não pode ser alterada.' USING ERRCODE='42501';
 END IF;
 IF NEW.name LIKE '[Demonstração]%' OR EXISTS(
  SELECT 1 FROM public.companies c WHERE c.id=NEW.company_id AND c.is_example
 ) THEN NEW.is_example:=true; END IF;
 IF NEW.is_example AND NEW.status<>'rascunho' THEN
  RAISE EXCEPTION 'Orçamentos de demonstração não podem ser submetidos ou enviados. Crie uma proposta real separadamente.' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END;
$guard$;
REVOKE ALL ON FUNCTION public.tercis_guard_example_budget() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER aaa_tercis_example_budget_guard BEFORE INSERT OR UPDATE ON public.budgets
 FOR EACH ROW EXECUTE FUNCTION public.tercis_guard_example_budget();

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
    FROM public.budgets b WHERE b.archived_at IS NULL AND NOT b.is_example
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
    'companies_count',(SELECT count(*) FROM public.companies c WHERE c.active IS TRUE AND NOT c.is_example)
  ) INTO v_result FROM totals t;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_dashboard_kpis()
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_dashboard_kpis() TO authenticated;

-- Complete, RLS-scoped reporting across EVERY visible proposal.
-- Avoid the first-100-row SPA pagination artefact. Proposal volume is not
-- booked revenue and is deliberately labelled as an estimate.
CREATE OR REPLACE FUNCTION public.tercis_report_summary(
  p_months integer DEFAULT 6,p_status text DEFAULT '',
  p_company_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path=public,pg_temp AS $$
DECLARE v_start date; v_end date; v_result jsonb;
BEGIN
  IF NOT public.tercis_is_internal_staff() THEN
    RAISE EXCEPTION 'Relatórios internos indisponíveis para este utilizador.'
      USING ERRCODE='42501';
  END IF;
  IF p_months NOT IN (6,12) THEN
    RAISE EXCEPTION 'Período inválido.' USING ERRCODE='22023';
  END IF;
  IF p_status IS NULL THEN p_status:=''; END IF;
  v_end:=(date_trunc('month',current_date)+interval '1 month')::date;
  v_start:=(date_trunc('month',current_date)-(p_months-1)*interval '1 month')::date;
  WITH priced AS (
    SELECT b.id,b.status,b.company_id,b.date,
      COALESCE((
        SELECT sum(round(
          round(round(coalesce(i.unit_cost,0)*(1+coalesce(i.margin,0)/100),4)*
            (1-coalesce(i.discount,0)/100),4) * coalesce(i.quantity,0),2))
        FROM public.budget_items i WHERE i.budget_id=b.id
      ),0)::numeric AS net,
      b.include_tax,b.tax_rate
    FROM public.budgets b
    WHERE b.archived_at IS NULL AND NOT b.is_example AND b.date>=v_start AND b.date<v_end
      AND (p_status='' OR b.status=p_status)
      AND (p_company_id IS NULL OR b.company_id=p_company_id)
  ), valued AS (
    SELECT p.*,
      round(net + CASE WHEN include_tax IS TRUE
        THEN round(net*coalesce(tax_rate,0)/100,2) ELSE 0 END,2) AS amount
    FROM priced p
  ), months AS (
    SELECT to_char(g.m,'YYYY-MM') AS month_key,
      count(v.id)::bigint AS count,coalesce(round(sum(v.amount),2),0)::numeric AS value
    FROM generate_series(v_start::timestamp,(v_end-interval '1 month')::timestamp,
      interval '1 month') g(m)
    LEFT JOIN valued v ON date_trunc('month',v.date)::date=g.m::date
    GROUP BY g.m ORDER BY g.m
  ), by_status AS (
    SELECT status,count(*)::bigint AS count,round(sum(amount),2) AS value
    FROM valued GROUP BY status
  ), by_company AS (
    SELECT company_id,count(*)::bigint AS count,round(sum(amount),2) AS value
    FROM valued GROUP BY company_id
  )
  SELECT jsonb_build_object(
    'count',(SELECT count(*) FROM valued),
    'value',(SELECT coalesce(round(sum(amount),2),0) FROM valued),
    'client_count',(SELECT count(DISTINCT company_id) FROM valued WHERE company_id IS NOT NULL),
    'months',(SELECT coalesce(jsonb_agg(jsonb_build_object(
      'key',month_key,'count',count,'value',value) ORDER BY month_key),'[]'::jsonb) FROM months),
    'by_status',(SELECT coalesce(jsonb_agg(jsonb_build_object(
      'status',status,'count',count,'value',value)),'[]'::jsonb) FROM by_status),
    'by_company',(SELECT coalesce(jsonb_agg(jsonb_build_object(
      'company_id',company_id,'count',count,'value',value)
      ORDER BY value DESC),'[]'::jsonb) FROM by_company)
  ) INTO v_result;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_report_summary(integer,text,uuid)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_report_summary(integer,text,uuid)
  TO authenticated;
