-- MFA must also protect the initial submission made by an administrator.
-- A SECURITY DEFINER transition RPC does not inherit table RLS; checking
-- the assurance level in the workflow function is therefore mandatory.
-- Internal collaborators keep their existing draft/submission permissions.
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
  -- Protect approval, rejection, sending and completion even on a direct
  -- PostgREST UPDATE (not just when using the transition RPC).
  IF (
    (p_new IN ('em_analise_tecnica','aprovado','enviado','rejeitado',
               'pedido_alteracoes','expirado','em_execucao','concluido')
      AND NOT (v_role='client' OR (v_role='collaborator' AND v_collaborator_type='client')))
    OR (p_new='pendente_aprovacao' AND v_role IN ('admin','company_admin'))
  ) AND NOT public.tercis_verified_aal2() THEN
    RETURN false;
  END IF;

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


