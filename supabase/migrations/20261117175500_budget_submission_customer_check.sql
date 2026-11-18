/*
  A draft must have a customer before submission. Collaborators prepare
  unassigned drafts and a trusted administrator links the customer while the
  quote is still editable. Without this guard, a submitted quote with no
  customer becomes permanently locked without a recipient.
*/
CREATE OR REPLACE FUNCTION public.tercis_guard_budget_submission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
BEGIN
  IF NEW.status='pendente_aprovacao'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'Associe um cliente ao orçamento antes de o submeter para aprovação.'
      USING ERRCODE='22023';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tercis_guard_budget_submission_update ON public.budgets;
CREATE TRIGGER tercis_guard_budget_submission_update
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.tercis_guard_budget_submission();
REVOKE ALL ON FUNCTION public.tercis_guard_budget_submission()
  FROM PUBLIC,anon,authenticated;
