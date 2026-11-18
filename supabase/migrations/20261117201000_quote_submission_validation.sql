-- Server-side commercial integrity: draft submission, publication and acceptance.
-- These checks apply to direct PostgREST updates AND the transition RPC.
-- They intentionally do not reject historical archived rows until a state change.
CREATE OR REPLACE FUNCTION public.tercis_guard_quote_commercial_integrity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE bad_lines integer;
BEGIN
  -- Drafts may be incomplete; a quote must be commercially valid to submit.
  IF NEW.status IS DISTINCT FROM OLD.status AND
     NEW.status IN ('pendente_aprovacao','aprovado','enviado','aceite') THEN
    IF NEW.date IS NULL OR NEW.valid_until IS NULL OR
       NEW.valid_until < NEW.date THEN
      RAISE EXCEPTION 'Corrija as datas de emissão e validade da proposta.'
        USING ERRCODE='22023';
    END IF;
    IF NEW.status IN ('pendente_aprovacao','aprovado','enviado') THEN
      IF NEW.company_id IS NULL OR length(btrim(NEW.name))=0 THEN
        RAISE EXCEPTION 'Associe um cliente e uma designação válida antes de submeter.'
          USING ERRCODE='22023';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.budget_items WHERE budget_id=NEW.id) THEN
        RAISE EXCEPTION 'Adicione pelo menos um item válido antes de submeter a proposta.'
          USING ERRCODE='22023';
      END IF;
      SELECT count(*) INTO bad_lines FROM public.budget_items i
      WHERE i.budget_id=NEW.id
        AND (length(btrim(i.description))=0 OR i.quantity IS NULL OR i.quantity<=0
          OR i.unit_cost IS NULL OR i.unit_cost<0
          OR i.margin IS NULL OR i.margin<0
          OR i.discount IS NULL OR i.discount NOT BETWEEN 0 AND 100);
      IF bad_lines>0 THEN
        RAISE EXCEPTION 'A proposta contém itens sem descrição, com quantidades ou preços inválidos.'
          USING ERRCODE='22023';
      END IF;
    END IF;
    IF NEW.status IN ('enviado','aceite') AND NEW.valid_until < CURRENT_DATE THEN
      RAISE EXCEPTION 'A proposta ultrapassou a validade e não pode ser enviada ou aceite.'
        USING ERRCODE='22023';
    END IF;
    IF NEW.status='aceite' AND NEW.sent_at IS NULL THEN
      RAISE EXCEPTION 'Uma proposta não publicada não pode ser aceite.'
        USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tercis_guard_quote_commercial_integrity ON public.budgets;
CREATE TRIGGER tercis_guard_quote_commercial_integrity
  BEFORE UPDATE OF status ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.tercis_guard_quote_commercial_integrity();
REVOKE ALL ON FUNCTION public.tercis_guard_quote_commercial_integrity()
  FROM PUBLIC,anon,authenticated;

-- RLS and the above trigger protect status transitions. These constraints
-- additionally reject malformed data when the header is written directly.
ALTER TABLE public.budgets
  ADD CONSTRAINT tercis_valid_tax_rate CHECK (
    tax_rate IS NOT NULL AND tax_rate BETWEEN 0 AND 100
  ) NOT VALID;
ALTER TABLE public.budget_items
  ADD CONSTRAINT tercis_valid_line_prices CHECK (
    quantity IS NOT NULL AND quantity>0 AND unit_cost IS NOT NULL AND unit_cost>=0
    AND margin IS NOT NULL AND margin>=0 AND
    discount IS NOT NULL AND discount BETWEEN 0 AND 100
  ) NOT VALID;
