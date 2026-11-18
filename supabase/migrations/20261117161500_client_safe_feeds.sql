/*
  Customer-safe budget and message feeds.

  RLS alone is row-based and does not redact unit_cost, margin, internal notes or
  contact fields from a budget row. Customers must not SELECT raw budget and item
  records; instead, a scoped SECURITY DEFINER read returns only the public quote
  price and approved metadata. This change is staged, not deployed to production.

  Existing tenant architecture still needs an independent organisation_id.
*/
CREATE OR REPLACE FUNCTION public.tercis_current_client_company()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
  SELECT p.company_id FROM public.profiles p
  WHERE p.id=(SELECT auth.uid()) AND p.active IS TRUE
    AND (p.role='client' OR (p.role='collaborator' AND p.collaborator_type='client'))
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.tercis_current_client_company() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_current_client_company() TO authenticated;

DROP POLICY IF EXISTS "Tercis raw budgets for internal staff only" ON public.budgets;
CREATE POLICY "Tercis raw budgets for internal staff only"
  ON public.budgets AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.tercis_is_internal_staff());

DROP POLICY IF EXISTS "Tercis raw budget items for internal staff only" ON public.budget_items;
CREATE POLICY "Tercis raw budget items for internal staff only"
  ON public.budget_items AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.tercis_is_internal_staff());

CREATE OR REPLACE FUNCTION public.tercis_client_quote_feed()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
  v_company uuid;
  v_data jsonb;
BEGIN
  v_company:=public.tercis_current_client_company();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Esta operação é exclusiva de clientes ativos associados a uma empresa.'
      USING ERRCODE='42501';
  END IF;
  SELECT coalesce(jsonb_agg(entry ORDER BY sort_time DESC),'[]'::jsonb) INTO v_data
  FROM (
    SELECT b.created_at AS sort_time,
      jsonb_build_object(
        'id',b.id,'ref',b.ref,'name',b.name,'company_id',b.company_id,
        'company',jsonb_build_object('id',c.id,'name',c.name),
        'assigned_to',NULL,'status',b.status,'sector',b.sector,
        'date',b.date,'valid_until',b.valid_until,
        'notes','','client_contact','','client_email','',
        'include_tax',b.include_tax,'tax_rate',b.tax_rate,
        'version',b.version,'created_at',b.created_at,'updated_at',b.updated_at,
        'items',coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'id',i.id,'budget_id',i.budget_id,'code',i.code,
            'description',i.description,'reference',i.reference,
            'unit',i.unit,'quantity',i.quantity,
            -- customer unit price includes margin and item discount; cost and
            -- margin are NEVER returned to the browser
            'unit_price',round(i.unit_cost*(1+i.margin/100)*(1-i.discount/100),4),
            'sort_order',i.sort_order
          ) ORDER BY i.sort_order)
          FROM public.budget_items i WHERE i.budget_id=b.id
        ),'[]'::jsonb)
      ) AS entry
    FROM public.budgets b
    JOIN public.companies c ON c.id=b.company_id
    WHERE b.company_id=v_company
      AND b.status IN ('enviado','aceite','rejeitado','pedido_alteracoes',
                       'expirado','em_execucao','concluido')
    ORDER BY b.created_at DESC LIMIT 500
  ) data;
  RETURN coalesce(v_data,'[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_client_quote_feed() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_client_quote_feed() TO authenticated;

CREATE OR REPLACE FUNCTION public.tercis_client_message_feed()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE v_company uuid; v_data jsonb;
BEGIN
  v_company:=public.tercis_current_client_company();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Esta operação é exclusiva de clientes ativos.' USING ERRCODE='42501';
  END IF;

  SELECT coalesce(jsonb_agg(entry ORDER BY sort_time DESC),'[]'::jsonb) INTO v_data
  FROM (
    SELECT m.created_at AS sort_time,
      jsonb_build_object('id',m.id,'budget_id',m.budget_id,
        'body',m.body,'visibility',m.visibility,'sender_id',m.sender_id,
        'channel',m.channel,'created_at',m.created_at) AS entry
    FROM public.budget_messages m
    JOIN public.budgets b ON b.id=m.budget_id
    WHERE b.company_id=v_company AND m.company_id=v_company
      AND m.visibility IN ('client','both')
      AND b.status IN ('enviado','aceite','rejeitado','pedido_alteracoes',
                       'expirado','em_execucao','concluido')
    ORDER BY m.created_at DESC LIMIT 200
  ) data;
  RETURN coalesce(v_data,'[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_client_message_feed() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_client_message_feed() TO authenticated;
