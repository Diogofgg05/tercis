-- Company administrators, including legacy roles, never manage platform owners.
CREATE FUNCTION tercis_platform.protect_owner_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND NOT coalesce(tercis_platform.switching(),false)
 AND EXISTS(SELECT 1 FROM tercis_platform.administrators WHERE user_id=OLD.id)
 AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.active IS DISTINCT FROM OLD.active
 OR NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.email IS DISTINCT FROM OLD.email
 OR NEW.permissions IS DISTINCT FROM OLD.permissions OR NEW.company_id IS DISTINCT FROM OLD.company_id
 OR NEW.collaborator_type IS DISTINCT FROM OLD.collaborator_type OR NEW.customer_type_id IS DISTINCT FROM OLD.customer_type_id) THEN
  RAISE EXCEPTION 'A conta da administração da plataforma está protegida.' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION tercis_platform.protect_owner_profile() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER tercis_protect_platform_owner BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION tercis_platform.protect_owner_profile();
