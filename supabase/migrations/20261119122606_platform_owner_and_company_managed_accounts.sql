-- Platform ownership is separate from the operational role inside a company.
-- Switching the owner's workspace preserves the existing tenant RLS and workflows.
CREATE SCHEMA IF NOT EXISTS tercis_platform;
REVOKE ALL ON SCHEMA tercis_platform FROM PUBLIC,anon,authenticated;
CREATE TABLE tercis_platform.administrators(
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE tercis_platform.administrators ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tercis_platform.administrators FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.tercis_is_platform_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM tercis_platform.administrators a JOIN public.profiles p ON p.id=a.user_id
 WHERE a.user_id=auth.uid() AND a.active IS TRUE AND p.active IS TRUE);
$$;
REVOKE ALL ON FUNCTION public.tercis_is_platform_admin() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_is_platform_admin() TO authenticated;

CREATE FUNCTION tercis_platform.switching() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT current_setting('tercis.platform_switch',true)='on'
 AND public.tercis_is_platform_admin() AND public.tercis_verified_aal2();
$$;
REVOKE ALL ON FUNCTION tercis_platform.switching() FROM PUBLIC,anon,authenticated;

-- Preserve all pre-existing profile checks. Only the fixed-field, audited
-- workspace-switch RPC below can enable this transaction-local exception.
DO $$ DECLARE fn text;definition text; BEGIN
 FOREACH fn IN ARRAY ARRAY['tercis_guard_profile_privileges','tercis_guard_profile_organization'] LOOP
  SELECT pg_get_functiondef(to_regprocedure('public.'||fn||'()')) INTO definition;
  IF definition IS NULL THEN RAISE EXCEPTION 'Missing profile guard: %',fn;END IF;
  EXECUTE regexp_replace(definition,'BEGIN','BEGIN IF tercis_platform.switching() THEN RETURN NEW; END IF;');
 END LOOP;
END $$;

CREATE FUNCTION public.tercis_platform_organizations() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.tercis_is_platform_admin() OR NOT public.tercis_verified_aal2() THEN
  RAISE EXCEPTION 'Acesso reservado à administração da plataforma com MFA.' USING ERRCODE='42501';END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'slug',o.slug,
 'users',(SELECT count(*) FROM public.profiles p WHERE p.organization_id=o.id),
 'budgets',(SELECT count(*) FROM public.budgets b WHERE b.organization_id=o.id),
 'components',(SELECT count(*) FROM public.custom_catalog_items c WHERE c.organization_id=o.id AND c.active),
 'companies',(SELECT count(*) FROM public.companies c WHERE c.organization_id=o.id AND c.active)) ORDER BY o.name)
 FROM public.organizations o),'[]'::jsonb);
END $$;

CREATE FUNCTION public.tercis_enter_organization(p_organization_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous_org uuid;
BEGIN
 IF NOT public.tercis_is_platform_admin() OR NOT public.tercis_verified_aal2() THEN
  RAISE EXCEPTION 'Acesso reservado à administração da plataforma com MFA.' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.organizations WHERE id=p_organization_id) THEN
  RAISE EXCEPTION 'Empresa não encontrada.' USING ERRCODE='22023';END IF;
 SELECT organization_id INTO previous_org FROM public.profiles WHERE id=auth.uid() FOR UPDATE;
 PERFORM set_config('tercis.platform_switch','on',true);
 UPDATE public.profiles SET organization_id=p_organization_id,role='company_admin',collaborator_type='internal',
 company_id=NULL,customer_type_id=NULL WHERE id=auth.uid();
 PERFORM set_config('tercis.platform_switch','',true);
 INSERT INTO public.audit_logs(organization_id,actor_id,entity_type,entity_id,action,metadata)
 VALUES(p_organization_id,auth.uid(),'organization',p_organization_id,'platform_workspace_entered',jsonb_build_object('previous_organization_id',previous_org));
 RETURN p_organization_id;
END $$;

CREATE FUNCTION public.tercis_platform_create_organization(p_name text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE new_id uuid:=gen_random_uuid();
BEGIN
 IF NOT public.tercis_is_platform_admin() OR NOT public.tercis_verified_aal2() THEN
  RAISE EXCEPTION 'Acesso reservado à administração da plataforma com MFA.' USING ERRCODE='42501';END IF;
 IF length(trim(coalesce(p_name,''))) NOT BETWEEN 2 AND 120 THEN
  RAISE EXCEPTION 'Indica um nome entre 2 e 120 caracteres.' USING ERRCODE='22023';END IF;
 INSERT INTO public.organizations(id,slug,name) VALUES(new_id,'empresa-'||new_id::text,trim(p_name));
 INSERT INTO public.audit_logs(organization_id,actor_id,entity_type,entity_id,action)
 VALUES(new_id,auth.uid(),'organization',new_id,'platform_organization_created');
 RETURN new_id;
END $$;

CREATE FUNCTION public.tercis_provisioning_scope(p_organization_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor public.profiles%ROWTYPE;org uuid;platform boolean;
BEGIN
 SELECT * INTO actor FROM public.profiles WHERE id=auth.uid() AND active IS TRUE;
 platform:=public.tercis_is_platform_admin();
 IF NOT FOUND OR NOT public.tercis_verified_aal2() OR (NOT platform AND actor.role NOT IN ('admin','company_admin')) THEN
  RAISE EXCEPTION 'Apenas administradores com MFA podem criar contas.' USING ERRCODE='42501';END IF;
 org:=coalesce(p_organization_id,actor.organization_id);
 IF org IS NULL OR (NOT platform AND org IS DISTINCT FROM actor.organization_id)
 OR NOT EXISTS(SELECT 1 FROM public.organizations WHERE id=org) THEN
  RAISE EXCEPTION 'Não podes criar contas para outra empresa.' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('actor_id',actor.id,'organization_id',org,'platform_admin',platform);
END $$;

-- Service-only completion after Auth Admin creates a new, administrator-verified identity.
CREATE FUNCTION public.tercis_complete_team_account(p_actor uuid,p_user_id uuid,p_organization_id uuid,p_role text,p_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor public.profiles%ROWTYPE;platform boolean;
BEGIN
 SELECT * INTO actor FROM public.profiles WHERE id=p_actor AND active IS TRUE FOR SHARE;
 platform:=EXISTS(SELECT 1 FROM tercis_platform.administrators WHERE user_id=p_actor AND active);
 IF NOT FOUND OR (NOT platform AND (actor.role NOT IN ('admin','company_admin') OR actor.organization_id IS DISTINCT FROM p_organization_id))
 OR p_role NOT IN ('collaborator','company_admin') OR (p_role='company_admin' AND NOT platform) THEN
  RAISE EXCEPTION 'Criação de conta não autorizada.' USING ERRCODE='42501';END IF;
 IF length(trim(coalesce(p_name,''))) NOT BETWEEN 2 AND 120 OR NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=p_user_id AND u.email_confirmed_at IS NOT NULL) THEN
  RAISE EXCEPTION 'Identidade ou nome inválido.' USING ERRCODE='22023';END IF;
 PERFORM 1 FROM public.profiles WHERE id=p_user_id AND active IS FALSE AND role='client' AND organization_id IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'A conta já pertence a uma empresa; adiciona-a pelo chat.' USING ERRCODE='42501';END IF;
 UPDATE public.profiles SET organization_id=p_organization_id,role=p_role,full_name=trim(p_name),active=true,collaborator_type='internal',company_id=NULL,customer_type_id=NULL WHERE id=p_user_id;
 UPDATE public.organization_invites SET used_at=now() WHERE organization_id=p_organization_id AND email=(SELECT email FROM public.profiles WHERE id=p_user_id) AND used_at IS NULL AND revoked_at IS NULL AND expires_at>now();
 INSERT INTO public.audit_logs(organization_id,actor_id,entity_type,entity_id,action,metadata)
 VALUES(p_organization_id,p_actor,'profile',p_user_id,'team_account_created',jsonb_build_object('role',p_role));
 RETURN p_user_id;
END $$;
REVOKE ALL ON FUNCTION public.tercis_complete_team_account(uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tercis_complete_team_account(uuid,uuid,uuid,text,text) TO service_role;

CREATE FUNCTION public.tercis_platform_update_member(p_user_id uuid,p_role text,p_active boolean,p_company_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid;
BEGIN
 IF NOT public.tercis_is_platform_admin() OR NOT public.tercis_verified_aal2() THEN
  RAISE EXCEPTION 'Acesso reservado à administração da plataforma com MFA.' USING ERRCODE='42501';END IF;
 org:=public.tercis_current_organization_id();
 IF p_role NOT IN ('collaborator','company_admin','client') OR p_active IS NULL
 OR EXISTS(SELECT 1 FROM tercis_platform.administrators WHERE user_id=p_user_id)
 OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_user_id AND organization_id=org) THEN
  RAISE EXCEPTION 'Perfil protegido ou fora da empresa selecionada.' USING ERRCODE='42501';END IF;
 IF p_company_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.companies WHERE id=p_company_id AND organization_id=org) THEN
  RAISE EXCEPTION 'Empresa cliente inválida.' USING ERRCODE='42501';END IF;
 IF p_role='client' AND p_active AND p_company_id IS NULL THEN RAISE EXCEPTION 'Associa o cliente à empresa.' USING ERRCODE='22023';END IF;
 UPDATE public.profiles SET role=p_role,active=p_active,company_id=p_company_id WHERE id=p_user_id;
 INSERT INTO public.audit_logs(organization_id,actor_id,entity_type,entity_id,action,metadata)
 VALUES(org,auth.uid(),'profile',p_user_id,'platform_team_updated',jsonb_build_object('role',p_role,'active',p_active));
 RETURN p_user_id;
END $$;

REVOKE ALL ON FUNCTION public.tercis_platform_organizations(),public.tercis_enter_organization(uuid),public.tercis_platform_create_organization(text),public.tercis_provisioning_scope(uuid),public.tercis_platform_update_member(uuid,text,boolean,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_platform_organizations(),public.tercis_enter_organization(uuid),public.tercis_platform_create_organization(text),public.tercis_provisioning_scope(uuid),public.tercis_platform_update_member(uuid,text,boolean,uuid) TO authenticated;
