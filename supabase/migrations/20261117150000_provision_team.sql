/*
  Controlled profile provisioning for legacy administrators only.

  Team management by company_admin is deliberately read-only until Tercis has
  separate organisations and customer entities. Do not grant tenant-wide profile
  changes via RLS or a SECURITY DEFINER function before that model exists.
*/
CREATE OR REPLACE FUNCTION public.tercis_admin_update_user(
  p_user_id uuid,
  p_role text,
  p_active boolean,
  p_company_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_target public.profiles%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_actor AND p.active = true AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Apenas administradores legados aprovados podem gerir contas nesta versão.'
      USING ERRCODE='42501';
  END IF;

  IF p_user_id = v_actor THEN
    RAISE EXCEPTION 'Não pode alterar as suas próprias permissões.'
      USING ERRCODE='42501';
  END IF;

  IF p_role NOT IN ('client','collaborator','company_admin') OR p_role IS NULL THEN
    RAISE EXCEPTION 'Papel de destino inválido.' USING ERRCODE='22023';
  END IF;

  IF p_active IS NULL THEN
    RAISE EXCEPTION 'Estado de acesso inválido.' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_target FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Utilizador não encontrado.' USING ERRCODE='22023';
  END IF;
  IF v_target.role IN ('admin','app_admin') THEN
    RAISE EXCEPTION 'Contas administrativas protegidas não podem ser alteradas por esta operação.'
      USING ERRCODE='42501';
  END IF;

  IF p_company_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.companies c WHERE c.id = p_company_id AND c.active IS TRUE
  ) THEN
    RAISE EXCEPTION 'Empresa associada não está ativa.' USING ERRCODE='22023';
  END IF;

  IF p_role IN ('client','company_admin') AND p_active AND p_company_id IS NULL THEN
    RAISE EXCEPTION 'Associe uma empresa antes de ativar este papel.' USING ERRCODE='22023';
  END IF;

  UPDATE public.profiles
     SET role = p_role, active = p_active, company_id = p_company_id
   WHERE id = p_user_id;

  INSERT INTO public.audit_logs (company_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (p_company_id, v_actor, 'profile', p_user_id, 'team_account_updated',
    jsonb_build_object('role', p_role, 'active', p_active));
  RETURN p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tercis_admin_update_user(uuid,text,boolean,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tercis_admin_update_user(uuid,text,boolean,uuid) TO authenticated;
