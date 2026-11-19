/*
  New quotes are always drafts.

  Previously a privileged caller could INSERT a row directly as "enviado",
  "aprovado", or "concluido", avoiding the audited transition workflow.
  Prevent that for authenticated user sessions at the database boundary.
  Trusted database operators/service-role migrations have auth.uid() NULL and
  can still seed historical records as part of controlled migration work.
*/
CREATE OR REPLACE FUNCTION public.tercis_guard_budget_initial_status()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.status IS DISTINCT FROM 'rascunho' THEN
    RAISE EXCEPTION 'Um orçamento novo deve começar como rascunho.'
      USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tercis_guard_budget_initial_status_insert
  ON public.budgets;
CREATE TRIGGER tercis_guard_budget_initial_status_insert
  BEFORE INSERT ON public.budgets FOR EACH ROW
  EXECUTE FUNCTION public.tercis_guard_budget_initial_status();

REVOKE ALL ON FUNCTION public.tercis_guard_budget_initial_status()
  FROM PUBLIC,anon,authenticated;
