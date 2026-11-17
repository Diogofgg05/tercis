/*
  Enforce Supabase AAL2 for privileged commercial sessions, account approvals,
  invitation issuance, and workflow decisions. React gates are NOT security.
  JWT claims are verified by Supabase Auth, not supplied by the browser as data.

  Existing user-facing customer acceptance remains possible at AAL1.
  The application must let administrators enroll a TOTP factor before use.
*/
CREATE OR REPLACE FUNCTION public.tercis_verified_aal2()
RETURNS boolean LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
  SELECT coalesce(auth.jwt()->>'aal','')='aal2';
$$;
REVOKE ALL ON FUNCTION public.tercis_verified_aal2() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_verified_aal2() TO authenticated;

CREATE OR REPLACE FUNCTION public.tercis_commercial_session_allowed()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id=(SELECT auth.uid()) AND p.active IS TRUE
        AND p.role IN ('admin','company_admin')
    ) THEN public.tercis_verified_aal2()
    ELSE TRUE
  END;
$$;
REVOKE ALL ON FUNCTION public.tercis_commercial_session_allowed() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_commercial_session_allowed() TO authenticated;

-- AAL1 admin sessions cannot bypass the app gate through raw table endpoints.
DO $$
DECLARE v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'companies','budgets','budget_items','budget_versions',
    'custom_catalog_items','company_settings','customer_types',
    'budget_timeline_events','budget_attachments','budget_messages','audit_logs'
  ] LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "Tercis privileged sessions require MFA" ON public.%I',
      v_table
    );
    EXECUTE format(
      'CREATE POLICY "Tercis privileged sessions require MFA" ON public.%I
         AS RESTRICTIVE FOR ALL TO authenticated
         USING (public.tercis_commercial_session_allowed())
         WITH CHECK (public.tercis_commercial_session_allowed())',
      v_table
    );
  END LOOP;
END;
$$;

-- Administrators with only a password may read their OWN profile to enroll
-- TOTP but must not query other employee profiles until AAL2 verification.
CREATE OR REPLACE FUNCTION public.tercis_can_read_profile(target_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=public,pg_temp AS $$
  SELECT target_id=(SELECT auth.uid()) OR (
    public.tercis_verified_aal2()
    AND EXISTS (
      SELECT 1 FROM public.profiles viewer
      JOIN public.profiles target ON target.id=target_id
      WHERE viewer.id=(SELECT auth.uid()) AND viewer.active IS TRUE
        AND viewer.role IN ('admin','company_admin')
        AND viewer.organization_id IS NOT NULL
        AND viewer.organization_id=target.organization_id
    )
  );
$$;
REVOKE ALL ON FUNCTION public.tercis_can_read_profile(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_can_read_profile(uuid) TO authenticated;

-- Functions running as SECURITY DEFINER bypass RLS: require AAL2 within them.
CREATE OR REPLACE FUNCTION public.tercis_admin_update_user(
  p_user_id uuid,p_role text,p_active boolean,p_company_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor uuid:=auth.uid(); v_org uuid; v_target public.profiles%ROWTYPE;
BEGIN
  IF NOT public.tercis_verified_aal2() THEN
    RAISE EXCEPTION 'A administração de utilizadores exige MFA verificado (AAL2).'
      USING ERRCODE='42501';
  END IF;
  SELECT organization_id INTO v_org FROM public.profiles
  WHERE id=v_actor AND role='admin' AND active IS TRUE;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Apenas o administrador da organização pode aprovar contas.'
      USING ERRCODE='42501';
  END IF;
  IF p_user_id=v_actor THEN
    RAISE EXCEPTION 'Não pode alterar o próprio papel.' USING ERRCODE='42501';
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('client','collaborator','company_admin')
    OR p_active IS NULL THEN
    RAISE EXCEPTION 'Dados de acesso inválidos.' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_target FROM public.profiles WHERE id=p_user_id FOR UPDATE;
  IF NOT FOUND OR v_target.organization_id IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'Utilizador inexistente ou fora da organização.'
      USING ERRCODE='42501';
  END IF;
  IF v_target.role IN ('admin','app_admin') THEN
    RAISE EXCEPTION 'Perfil administrativo protegido.' USING ERRCODE='42501';
  END IF;
  IF p_company_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id=p_company_id AND c.organization_id=v_org AND c.active IS TRUE
  ) THEN
    RAISE EXCEPTION 'O cliente escolhido não pertence à sua organização.'
      USING ERRCODE='42501';
  END IF;
  IF p_role IN ('client','company_admin') AND p_active AND p_company_id IS NULL THEN
    RAISE EXCEPTION 'Indique a empresa cliente antes de ativar esta conta.'
      USING ERRCODE='22023';
  END IF;
  UPDATE public.profiles SET role=p_role,active=p_active,company_id=p_company_id
  WHERE id=p_user_id;
  INSERT INTO public.audit_logs (
    organization_id,company_id,actor_id,entity_type,entity_id,action,metadata
  ) VALUES (
    v_org,p_company_id,v_actor,'profile',p_user_id,'team_account_updated',
    jsonb_build_object('role',p_role,'active',p_active)
  );
  RETURN p_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_admin_update_user(uuid,text,boolean,uuid)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_admin_update_user(uuid,text,boolean,uuid)
  TO authenticated;


CREATE OR REPLACE FUNCTION public.tercis_create_organization_invite(
  p_email text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_actor uuid:=auth.uid(); v_org uuid; v_token uuid;
BEGIN
  IF NOT public.tercis_verified_aal2() THEN
    RAISE EXCEPTION 'A criação de convites exige MFA verificado (AAL2).'
      USING ERRCODE='42501';
  END IF;
  SELECT organization_id INTO v_org FROM public.profiles
  WHERE id=v_actor AND active IS TRUE AND role='admin';
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Apenas administradores autorizados podem emitir convites.'
      USING ERRCODE='42501';
  END IF;
  IF p_email IS NULL OR length(btrim(p_email))>254 OR
     lower(btrim(p_email)) !~ '^[^ @]+@[^ @]+[.][^ @]+$' THEN
    RAISE EXCEPTION 'Email de convite inválido.' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.organization_invites(organization_id,email,invited_by)
  VALUES(v_org,lower(btrim(p_email)),v_actor)
  RETURNING id INTO v_token;
  INSERT INTO public.audit_logs(
    organization_id,actor_id,entity_type,entity_id,action
  ) VALUES(v_org,v_actor,'organization_invite',v_token,'invite_created');
  RETURN v_token;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_create_organization_invite(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_create_organization_invite(text) TO authenticated;


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
  IF p_new IN ('em_analise_tecnica','aprovado','enviado','rejeitado',
                'pedido_alteracoes','expirado','em_execucao','concluido')
    AND NOT (v_role='client' OR (v_role='collaborator' AND v_collaborator_type='client'))
    AND NOT public.tercis_verified_aal2() THEN
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


