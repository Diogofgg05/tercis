-- Per-customer document counts must reflect the real database, not only
-- the first 100 currently loaded budget documents.
CREATE OR REPLACE FUNCTION public.tercis_company_budget_counts()
RETURNS TABLE(company_id uuid,quote_count bigint)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path=public,pg_temp AS $$
BEGIN
  IF NOT public.tercis_is_internal_staff() THEN
    RAISE EXCEPTION 'Contagens de propostas reservadas à equipa interna.'
      USING ERRCODE='42501';
  END IF;
  RETURN QUERY
  SELECT b.company_id,count(*)::bigint AS quote_count
  FROM public.budgets b
  WHERE b.company_id IS NOT NULL
  GROUP BY b.company_id;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_company_budget_counts()
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_company_budget_counts()
  TO authenticated;
