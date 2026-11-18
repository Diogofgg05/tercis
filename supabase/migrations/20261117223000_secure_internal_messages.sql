-- Internal notes only. A client-facing conversation needs a separate
-- publication/visibility design, and must not leak internal revision chatter.
-- SECURITY DEFINER performs explicit tenant, assignment and role checks.
CREATE OR REPLACE FUNCTION public.tercis_send_internal_budget_message(
  p_budget_id uuid,p_body text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor uuid:=auth.uid(); v_profile public.profiles%ROWTYPE;
DECLARE v_budget public.budgets%ROWTYPE; v_id uuid;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id=v_actor AND active IS TRUE;
  IF NOT FOUND OR v_profile.organization_id IS NULL OR
    NOT (v_profile.role IN ('admin','company_admin') OR
      (v_profile.role='collaborator' AND v_profile.collaborator_type='internal')) THEN
    RAISE EXCEPTION 'Apenas pessoal interno pode escrever notas.'
      USING ERRCODE='42501';
  END IF;
  IF p_body IS NULL OR length(btrim(p_body))<1 OR
     length(p_body)>4000 OR p_body ~ '[\x00-\x08\x0B\x0C\x0E-\x1F]' THEN
    RAISE EXCEPTION 'A nota deve conter entre 1 e 4000 caracteres válidos.'
      USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_budget FROM public.budgets
  WHERE id=p_budget_id AND organization_id=v_profile.organization_id;
  IF NOT FOUND OR v_budget.archived_at IS NOT NULL OR
    (v_profile.role='collaborator' AND v_budget.created_by IS DISTINCT FROM v_actor
      AND v_budget.assigned_to IS DISTINCT FROM v_actor) THEN
    RAISE EXCEPTION 'Não pode escrever nesta proposta.'
      USING ERRCODE='42501';
  END IF;
  IF v_budget.company_id IS NULL THEN
    RAISE EXCEPTION 'Associe uma empresa à proposta antes de criar notas.'
      USING ERRCODE='22023';
  END IF;
  INSERT INTO public.budget_messages(
    budget_id,company_id,sender_id,channel,body,visibility
  ) VALUES (
    v_budget.id,v_budget.company_id,v_actor,'portal',btrim(p_body),'internal'
  ) RETURNING id INTO v_id;
  INSERT INTO public.audit_logs(
    organization_id,company_id,actor_id,entity_type,entity_id,action,metadata
  ) VALUES (
    v_profile.organization_id,v_budget.company_id,v_actor,
    'budget',v_budget.id,'internal_message_created',
    jsonb_build_object('message_id',v_id)
  );
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_send_internal_budget_message(uuid,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_send_internal_budget_message(uuid,text)
  TO authenticated;
