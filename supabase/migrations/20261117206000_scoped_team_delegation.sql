-- Company administrators can manage ordinary members of their OWN
-- organization at AAL2. They cannot appoint/remove peer administrators or
-- change roles of legacy/platform admins. Every action is audited.
-- Principal "admin" remains the only role allowed to promote company_admin.
CREATE OR REPLACE FUNCTION public.tercis_admin_update_user(
  p_user_id uuid,p_role text,p_active boolean,p_company_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor uuid:=auth.uid(); v_org uuid; v_actor_role text; v_target public.profiles%ROWTYPE;
BEGIN
  IF NOT public.tercis_verified_aal2() THEN
    RAISE EXCEPTION 'A administração de utilizadores exige MFA verificado (AAL2).'
      USING ERRCODE='42501';
  END IF;
  SELECT organization_id,role INTO v_org,v_actor_role FROM public.profiles
  WHERE id=v_actor AND role IN ('admin','company_admin') AND active IS TRUE;
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
  IF v_target.role IN ('admin','app_admin') OR
     (v_actor_role='company_admin' AND (
        v_target.role='company_admin' OR p_role='company_admin')) THEN
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
  WHERE id=v_actor AND active IS TRUE AND role IN ('admin','company_admin');
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


