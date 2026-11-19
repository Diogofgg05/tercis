-- Return the exact committed optimistic-lock token, not a frontend guess.
-- The original atomic saver stays untouched for backward compatibility.
-- SECURITY INVOKER preserves RLS and keeps writes and version reads within
-- the same PostgreSQL transaction.
CREATE OR REPLACE FUNCTION public.save_budget_atomic_versioned(
  p_budget jsonb,p_items jsonb
) RETURNS TABLE(id uuid,version integer)
LANGUAGE plpgsql SECURITY INVOKER
SET search_path=public,pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  v_id:=public.save_budget_atomic(p_budget,p_items);
  RETURN QUERY
    SELECT b.id,b.version
    FROM public.budgets b
    WHERE b.id=v_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'O orçamento foi guardado, mas a versão não pôde ser confirmada.'
      USING ERRCODE='42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.save_budget_atomic_versioned(jsonb,jsonb)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_budget_atomic_versioned(jsonb,jsonb)
  TO authenticated;
