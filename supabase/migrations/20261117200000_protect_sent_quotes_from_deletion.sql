-- Preserve every quote that has ever been sent to a client.
-- Status 'rascunho' is not evidence that a quote was never published:
-- rejected/expired quotes can legitimately return to draft for revision.
DROP POLICY IF EXISTS "Tercis only drafts can be deleted" ON public.budgets;
CREATE POLICY "Tercis only unsent drafts can be deleted"
  ON public.budgets AS RESTRICTIVE FOR DELETE TO authenticated
  USING (status='rascunho' AND sent_at IS NULL);

CREATE OR REPLACE FUNCTION public.tercis_protect_published_budget_deletion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
BEGIN
  -- A trigger also protects against accidental privileged maintenance writes,
  -- which bypass regular table RLS.
  IF OLD.sent_at IS NOT NULL THEN
    RAISE EXCEPTION 'Uma proposta já enviada não pode ser eliminada. Arquive-a ou faça uma revisão.'
      USING ERRCODE='42501';
  END IF;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS tercis_protect_published_budget_deletion
  ON public.budgets;
CREATE TRIGGER tercis_protect_published_budget_deletion
  BEFORE DELETE ON public.budgets FOR EACH ROW
  EXECUTE FUNCTION public.tercis_protect_published_budget_deletion();
REVOKE ALL ON FUNCTION public.tercis_protect_published_budget_deletion()
  FROM PUBLIC,anon,authenticated;
