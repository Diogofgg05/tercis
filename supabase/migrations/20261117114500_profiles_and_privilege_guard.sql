/*
  Tercis: columns used by the settings form + self-service privilege guard.

  The original "Users can update own profile" RLS policy permits UPDATE on
  all columns, including role and permissions. Prevent a normal user from
  escalating their own account by changing protected fields.

  Existing admin/team provisioning must be separately audited before launch.
*/
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS job_title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS department text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS nif text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS postal_code text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS locality text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS website text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.tercis_guard_profile_privileges()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND OLD.id = auth.uid() THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.permissions IS DISTINCT FROM OLD.permissions
       OR NEW.collaborator_type IS DISTINCT FROM OLD.collaborator_type
       OR NEW.customer_type_id IS DISTINCT FROM OLD.customer_type_id
       OR NEW.active IS DISTINCT FROM OLD.active
       OR NEW.email IS DISTINCT FROM OLD.email
    THEN
      RAISE EXCEPTION 'Não pode alterar as permissões, empresa, identidade de acesso ou estado do próprio perfil.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tercis_guard_profile_privileges_on_update ON public.profiles;
CREATE TRIGGER tercis_guard_profile_privileges_on_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tercis_guard_profile_privileges();
REVOKE ALL ON FUNCTION public.tercis_guard_profile_privileges() FROM PUBLIC, anon, authenticated;
