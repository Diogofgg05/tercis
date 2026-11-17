/*
  Final defence for commercial budget contents. Versioned state transitions
  operate on the budget metadata. Quoted/sent/approved commercial values must
  never be silently edited, nor their line items replaced through PostgREST.

  This migration does NOT replace organisation-specific RLS: the existing
  tenant/company distinction still needs an independent tenant model.
*/

CREATE OR REPLACE FUNCTION public.tercis_guard_commercial_budget_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
BEGIN
  IF OLD.status NOT IN ('rascunho','rejeitado','pedido_alteracoes','expirado')
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
    RAISE EXCEPTION 'Os dados comerciais de uma proposta submetida ou publicada estão bloqueados. Crie uma revisão para a editar.'
      USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tercis_guard_commercial_budget_fields_update
  ON public.budgets;
CREATE TRIGGER tercis_guard_commercial_budget_fields_update
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.tercis_guard_commercial_budget_fields();
REVOKE ALL ON FUNCTION public.tercis_guard_commercial_budget_fields()
  FROM PUBLIC,anon,authenticated;

-- Any DELETE must be both permitted by legacy role/ownership RLS and
-- restricted to an editable, unpublished draft.
DROP POLICY IF EXISTS "Tercis only drafts can be deleted" ON public.budgets;
CREATE POLICY "Tercis only drafts can be deleted"
  ON public.budgets AS RESTRICTIVE FOR DELETE TO authenticated
  USING (status = 'rascunho');

DROP POLICY IF EXISTS "Tercis edit phase for budget line insert"
  ON public.budget_items;
CREATE POLICY "Tercis edit phase for budget line insert"
  ON public.budget_items AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.budgets b
      WHERE b.id = budget_id
        AND b.status IN ('rascunho','rejeitado','pedido_alteracoes','expirado')
    )
  );

DROP POLICY IF EXISTS "Tercis edit phase for budget line update"
  ON public.budget_items;
CREATE POLICY "Tercis edit phase for budget line update"
  ON public.budget_items AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.budgets b
      WHERE b.id = budget_id
        AND b.status IN ('rascunho','rejeitado','pedido_alteracoes','expirado')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.budgets b
      WHERE b.id = budget_id
        AND b.status IN ('rascunho','rejeitado','pedido_alteracoes','expirado')
    )
  );

DROP POLICY IF EXISTS "Tercis edit phase for budget line delete"
  ON public.budget_items;
CREATE POLICY "Tercis edit phase for budget line delete"
  ON public.budget_items AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.budgets b
      WHERE b.id = budget_id
        AND b.status IN ('rascunho','rejeitado','pedido_alteracoes','expirado')
    )
  );
