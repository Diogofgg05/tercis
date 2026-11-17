/*
  Tercis - atomic budget persistence.

  A single authenticated RPC replaces the old 3-request flow:
  upsert parent -> DELETE all children -> INSERT children.
  PostgreSQL rolls back *all* writes if a line is invalid or a policy fails.

  SECURITY INVOKER is deliberate: existing RLS policies remain in force.
  Administrators should review the existing multi-company RLS separately before
  commercial production; this migration is not a complete tenant isolation audit.
*/
CREATE OR REPLACE FUNCTION public.save_budget_atomic(
  p_budget jsonb,
  p_items jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_existing boolean;
  v_item jsonb;
  v_count int := 0;
  v_role text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'É necessária autenticação.' USING ERRCODE = '28000';
  END IF;

  SELECT role INTO v_role FROM public.profiles
  WHERE id = v_uid AND active IS TRUE;

  IF v_role IS NULL OR v_role NOT IN ('admin', 'company_admin', 'collaborator') THEN
    RAISE EXCEPTION 'Sem permissão para guardar orçamentos.' USING ERRCODE = '42501';
  END IF;

  IF p_budget IS NULL OR jsonb_typeof(p_budget) <> 'object'
     OR p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) > 500 THEN
    RAISE EXCEPTION 'Orçamento ou lista de itens inválidos.' USING ERRCODE = '22023';
  END IF;

  IF nullif(trim(p_budget ->> 'name'), '') IS NULL THEN
    RAISE EXCEPTION 'A designação do orçamento é obrigatória.' USING ERRCODE = '22023';
  END IF;

  v_id := (p_budget ->> 'id')::uuid;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Identificador do orçamento em falta.' USING ERRCODE = '22023';
  END IF;

  -- Only rows visible under RLS can be updated. Explicit lock prevents
  -- concurrent saves from interleaving modifications on the same budget.
  SELECT true INTO v_existing
  FROM public.budgets
  WHERE id = v_id
  FOR UPDATE;

  IF coalesce(v_existing, false) THEN
    UPDATE public.budgets SET
      ref = p_budget ->> 'ref',
      name = trim(p_budget ->> 'name'),
      company_id = nullif(p_budget ->> 'company_id','')::uuid,
      assigned_to = nullif(p_budget ->> 'assigned_to','')::uuid,
      status = coalesce(p_budget ->> 'status','rascunho'),
      sector = coalesce(p_budget ->> 'sector',''),
      date = (p_budget ->> 'date')::date,
      valid_until = (p_budget ->> 'valid_until')::date,
      notes = coalesce(p_budget ->> 'notes',''),
      client_contact = coalesce(p_budget ->> 'client_contact',''),
      client_email = coalesce(p_budget ->> 'client_email',''),
      include_tax = coalesce((p_budget ->> 'include_tax')::boolean,false),
      tax_rate = coalesce((p_budget ->> 'tax_rate')::numeric,23),
      updated_at = now()
    WHERE id = v_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Não foi possível atualizar o orçamento.' USING ERRCODE = '42501';
    END IF;
  ELSE
    INSERT INTO public.budgets (
      id,ref,name,company_id,assigned_to,status,sector,date,valid_until,
      notes,client_contact,client_email,include_tax,tax_rate,created_by
    ) VALUES (
      v_id,p_budget ->> 'ref',trim(p_budget ->> 'name'),
      nullif(p_budget ->> 'company_id','')::uuid,
      nullif(p_budget ->> 'assigned_to','')::uuid,
      coalesce(p_budget ->> 'status','rascunho'),
      coalesce(p_budget ->> 'sector',''),
      (p_budget ->> 'date')::date,
      (p_budget ->> 'valid_until')::date,
      coalesce(p_budget ->> 'notes',''),
      coalesce(p_budget ->> 'client_contact',''),
      coalesce(p_budget ->> 'client_email',''),
      coalesce((p_budget ->> 'include_tax')::boolean,false),
      coalesce((p_budget ->> 'tax_rate')::numeric,23),v_uid
    );
  END IF;

  DELETE FROM public.budget_items WHERE budget_id = v_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF jsonb_typeof(v_item) <> 'object'
       OR coalesce((v_item ->> 'quantity')::numeric,0) <= 0
       OR coalesce((v_item ->> 'unit_cost')::numeric,0) < 0
       OR coalesce((v_item ->> 'margin')::numeric,0) < -100
       OR coalesce((v_item ->> 'discount')::numeric,0) NOT BETWEEN 0 AND 100
    THEN
      RAISE EXCEPTION 'Foi encontrado um item inválido.' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.budget_items (
      id,budget_id,code,description,reference,brand,category,sector,
      unit,quantity,unit_cost,margin,discount,notes,sort_order
    ) VALUES (
      CASE WHEN (v_item ->> 'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN (v_item ->> 'id')::uuid ELSE gen_random_uuid() END,
      v_id,coalesce(v_item ->> 'code',''),coalesce(v_item ->> 'description',''),
      coalesce(v_item ->> 'reference',''),coalesce(v_item ->> 'brand',''),
      coalesce(v_item ->> 'category',''),coalesce(v_item ->> 'sector',''),
      coalesce(v_item ->> 'unit','un'),
      (v_item ->> 'quantity')::numeric,
      coalesce((v_item ->> 'unit_cost')::numeric,0),
      coalesce((v_item ->> 'margin')::numeric,0),
      coalesce((v_item ->> 'discount')::numeric,0),
      coalesce(v_item ->> 'notes',''),v_count
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_budget_atomic(jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_budget_atomic(jsonb,jsonb) TO authenticated;
