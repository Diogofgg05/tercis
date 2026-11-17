/*
  Server-side budget transition guard and approved reply endpoint.
  UI dropdowns are NEVER authorization. This migration checks every status
  change, including attempts to bypass the UI via direct PostgREST writes.
*/
CREATE OR REPLACE FUNCTION public.tercis_budget_can_move(
  p_old text, p_new text, p_actor uuid
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=public, pg_temp
AS $$
DECLARE
  v_role text;
  v_collaborator_type text;
  v_permissions text[];
  v_flow boolean := false;
BEGIN
  SELECT role, collaborator_type, permissions
    INTO v_role,v_collaborator_type,v_permissions
    FROM public.profiles WHERE id=p_actor AND active IS TRUE;
  IF v_role IS NULL THEN RETURN false; END IF;
  v_permissions:=coalesce(v_permissions,'{}'::text[]);
  v_flow:=CASE p_old
    WHEN 'rascunho' THEN p_new IN ('pendente_aprovacao')
    WHEN 'pendente_aprovacao' THEN p_new IN ('em_analise_tecnica','aprovado','rejeitado','pedido_alteracoes')
    WHEN 'em_analise_tecnica' THEN p_new IN ('aprovado','rejeitado','pedido_alteracoes')
    WHEN 'aprovado' THEN p_new IN ('enviado','em_execucao')
    WHEN 'enviado' THEN p_new IN ('aceite','rejeitado','pedido_alteracoes','expirado')
    WHEN 'rejeitado' THEN p_new='rascunho'
    WHEN 'pedido_alteracoes' THEN p_new='rascunho'
    WHEN 'expirado' THEN p_new='rascunho'
    WHEN 'aceite' THEN p_new IN ('em_execucao','concluido')
    WHEN 'em_execucao' THEN p_new='concluido'
    ELSE false END;
  IF NOT v_flow THEN RETURN false; END IF;

  IF v_role='client' OR (v_role='collaborator' AND v_collaborator_type='client') THEN
    RETURN p_old='enviado' AND p_new IN ('aceite','rejeitado','pedido_alteracoes');
  END IF;

  IF p_new='pendente_aprovacao' THEN
    RETURN v_role IN ('admin','company_admin','collaborator')
      OR 'submit_budgets'=ANY(v_permissions);
  END IF;
  IF p_new IN ('em_analise_tecnica','aprovado','rejeitado','pedido_alteracoes','em_execucao','concluido') THEN
    RETURN v_role IN ('admin','company_admin') OR 'approve_budgets'=ANY(v_permissions);
  END IF;
  IF p_new IN ('enviado','expirado') THEN
    RETURN v_role IN ('admin','company_admin') OR 'send_budgets'=ANY(v_permissions);
  END IF;
  IF p_new='rascunho' THEN
    RETURN v_role IN ('admin','company_admin','collaborator')
      OR 'create_budgets'=ANY(v_permissions);
  END IF;
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_budget_can_move(text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_budget_can_move(text,text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.tercis_guard_budget_status()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path=public,pg_temp
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT public.tercis_budget_can_move(OLD.status,NEW.status,auth.uid()) THEN
      RAISE EXCEPTION 'Transição de estado não autorizada ou inválida.'
        USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tercis_guard_budget_status_update ON public.budgets;
CREATE TRIGGER tercis_guard_budget_status_update
BEFORE UPDATE ON public.budgets
FOR EACH ROW EXECUTE FUNCTION public.tercis_guard_budget_status();
REVOKE ALL ON FUNCTION public.tercis_guard_budget_status() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.tercis_transition_budget(
  p_budget_id uuid,p_to text,p_expected_version integer
) RETURNS TABLE (id uuid, version integer, status text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text;
  v_kind text;
  v_company uuid;
  v_budget public.budgets%ROWTYPE;
  v_new_version integer;
BEGIN
  SELECT role,collaborator_type,company_id INTO v_role,v_kind,v_company
  FROM public.profiles WHERE id=v_actor AND active IS TRUE;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Conta não autorizada.' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_budget FROM public.budgets b
  WHERE b.id=p_budget_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado.' USING ERRCODE='22023';
  END IF;
  IF v_budget.version IS DISTINCT FROM p_expected_version THEN
    RAISE EXCEPTION 'O orçamento foi alterado noutra sessão. Reabra-o antes de alterar o estado.'
      USING ERRCODE='40001';
  END IF;

  IF v_role='client' OR (v_role='collaborator' AND v_kind='client') THEN
    IF v_company IS NULL OR v_company IS DISTINCT FROM v_budget.company_id THEN
      RAISE EXCEPTION 'Sem acesso a este orçamento.' USING ERRCODE='42501';
    END IF;
  ELSIF v_role='collaborator' THEN
    IF v_budget.created_by IS DISTINCT FROM v_actor
       AND v_budget.assigned_to IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'O orçamento não está atribuído à sua conta.' USING ERRCODE='42501';
    END IF;
  ELSIF v_role='company_admin' THEN
    -- Current schema lacks an independent organisation_id. Until migrated,
    -- restrict even admins to the explicit company_id of the budget.
    IF v_company IS NULL OR v_company IS DISTINCT FROM v_budget.company_id THEN
      RAISE EXCEPTION 'O orçamento não pertence à sua empresa associada.'
        USING ERRCODE='42501';
    END IF;
  ELSIF v_role <> 'admin' THEN
    RAISE EXCEPTION 'Sem autorização para a transição.' USING ERRCODE='42501';
  END IF;

  IF NOT public.tercis_budget_can_move(v_budget.status,p_to,v_actor) THEN
    RAISE EXCEPTION 'Transição de estado não permitida.' USING ERRCODE='42501';
  END IF;

  UPDATE public.budgets b SET
    status=p_to,
    version=b.version+1,
    submitted_at=CASE WHEN p_to='pendente_aprovacao' THEN now() ELSE b.submitted_at END,
    approved_at=CASE WHEN p_to='aprovado' THEN now() ELSE b.approved_at END,
    sent_at=CASE WHEN p_to='enviado' THEN now() ELSE b.sent_at END,
    accepted_at=CASE WHEN p_to='aceite' THEN now() ELSE b.accepted_at END
  WHERE b.id=p_budget_id
  RETURNING b.version INTO v_new_version;

  INSERT INTO public.audit_logs(company_id,actor_id,entity_type,entity_id,action,metadata)
  VALUES (v_budget.company_id,v_actor,'budget',p_budget_id,'status_changed',
    jsonb_build_object('from',v_budget.status,'to',p_to,'version',v_new_version));

  RETURN QUERY SELECT p_budget_id,v_new_version,p_to;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_transition_budget(uuid,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_transition_budget(uuid,text,integer) TO authenticated;
