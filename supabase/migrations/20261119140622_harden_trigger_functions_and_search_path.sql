-- Reconciles the hardening already installed remotely as
-- 20261118191046_tercis_harden_trigger_functions_and_search_path.
-- Idempotent: new installations and the hosted project receive identical ACLs.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.tercis_guard_archived_quote() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.tercis_guard_attachment_metadata() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.tercis_guard_audit_organization() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.tercis_guard_budget_organization() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.tercis_guard_catalog_organization() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.tercis_guard_company_organization() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.tercis_guard_profile_organization() FROM PUBLIC,anon,authenticated;
ALTER FUNCTION public.touch_budget() SET search_path TO public, pg_temp;
