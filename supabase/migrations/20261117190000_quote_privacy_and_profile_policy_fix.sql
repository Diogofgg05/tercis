/*
  Privacy/permissions patch. Apply after 20261117185000_catalog_cost_privacy.sql.

  1. Only published quotes can be returned from SECURITY DEFINER client RPCs.
  2. Direct profile INSERT/DELETE is disabled for authenticated users. The
     trusted auth signup trigger still creates profiles and approved legacy
     admins continue provisioning existing accounts via tercis_admin_update_user.
  3. The platform-only app_admin role no longer reads other users' profiles.
  4. Returned/rejected published quotes must be put in a NEW draft before
     commercial lines are modified; clients must never observe live re-pricing.
  Note: run the SQL regression suite in staging before deploying this migration.
*/

DROP POLICY IF EXISTS "Active legacy admins insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Tercis block direct profile insert" ON public.profiles;
CREATE POLICY "Tercis block direct profile insert"
  ON public.profiles AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "Active legacy admins delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Tercis block direct profile delete" ON public.profiles;
CREATE POLICY "Tercis block direct profile delete"
  ON public.profiles AS RESTRICTIVE FOR DELETE TO authenticated
  USING (false);

CREATE OR REPLACE FUNCTION public.tercis_can_read_profile(target_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
  SELECT target_id=(SELECT auth.uid()) OR EXISTS (
    SELECT 1 FROM public.profiles viewer
    WHERE viewer.id=(SELECT auth.uid())
      AND viewer.active IS TRUE AND viewer.role='admin'
  );
$$;
REVOKE ALL ON FUNCTION public.tercis_can_read_profile(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_can_read_profile(uuid) TO authenticated;

-- A previously-sent quote may be returned to draft, but not quietly edited
-- while still in an externally visible rejected/change-requested state.
DROP POLICY IF EXISTS "Tercis published lines inserted in draft only" ON public.budget_items;
CREATE POLICY "Tercis published lines inserted in draft only"
  ON public.budget_items AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id=budget_id AND (b.sent_at IS NULL OR b.status='rascunho')
  ));

DROP POLICY IF EXISTS "Tercis published lines updated in draft only" ON public.budget_items;
CREATE POLICY "Tercis published lines updated in draft only"
  ON public.budget_items AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id=budget_id AND (b.sent_at IS NULL OR b.status='rascunho')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id=budget_id AND (b.sent_at IS NULL OR b.status='rascunho')
  ));

DROP POLICY IF EXISTS "Tercis published lines deleted in draft only" ON public.budget_items;
CREATE POLICY "Tercis published lines deleted in draft only"
  ON public.budget_items AS RESTRICTIVE FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id=budget_id AND (b.sent_at IS NULL OR b.status='rascunho')
  ));

CREATE OR REPLACE FUNCTION public.tercis_guard_published_commercial_budget()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF OLD.sent_at IS NOT NULL AND OLD.status IN ('rejeitado','pedido_alteracoes','expirado')
    AND (
      NEW.ref,NEW.name,NEW.company_id,NEW.assigned_to,NEW.created_by,
      NEW.sector,NEW.date,NEW.valid_until,NEW.notes,NEW.client_contact,
      NEW.client_email,NEW.include_tax,NEW.tax_rate
    ) IS DISTINCT FROM (
      OLD.ref,OLD.name,OLD.company_id,OLD.assigned_to,OLD.created_by,
      OLD.sector,OLD.date,OLD.valid_until,OLD.notes,OLD.client_contact,
      OLD.client_email,OLD.include_tax,OLD.tax_rate
    )
  THEN
    RAISE EXCEPTION 'Uma proposta já enviada só pode ser editada depois de regressar a rascunho.'
      USING ERRCODE='42501';
  END IF;
  -- Sent timestamps may only be created by the approved -> sent transition.
  IF NEW.sent_at IS DISTINCT FROM OLD.sent_at AND NOT (
    OLD.status='aprovado' AND NEW.status='enviado'
    AND NEW.sent_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'A data de envio não pode ser modificada manualmente.'
      USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tercis_guard_published_commercial_budget_update ON public.budgets;
CREATE TRIGGER tercis_guard_published_commercial_budget_update
  BEFORE UPDATE ON public.budgets FOR EACH ROW
  EXECUTE FUNCTION public.tercis_guard_published_commercial_budget();
REVOKE ALL ON FUNCTION public.tercis_guard_published_commercial_budget()
  FROM PUBLIC,anon,authenticated;

-- Re-create both customer feeds with a required publication marker. Merely
-- being rejected or awaiting changes is not proof that a quote was sent.
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
      AND b.sent_at IS NOT NULL
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
      AND b.sent_at IS NOT NULL
      AND b.status IN ('enviado','aceite','rejeitado','pedido_alteracoes',
                       'expirado','em_execucao','concluido')
    ORDER BY m.created_at DESC LIMIT 200
  ) data;
  RETURN coalesce(v_data,'[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_client_message_feed() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_client_message_feed() TO authenticated;
