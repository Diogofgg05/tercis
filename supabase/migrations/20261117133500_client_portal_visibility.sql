/*
  Client portal visibility hardening.
  The original timeline/message/attachment SELECT rules mirrored budget access
  but ignored the record visibility column, leaking internal staff notes to
  customers. Fix SELECT and timeline INSERT, with budgets RLS still enforced.

  This is NOT full tenant isolation: "companies" currently represents
  customers as well as company membership. Enterprise SaaS requires an explicit
  organisation/tenant model and a complete audit of remaining RLS policies.
*/
CREATE OR REPLACE FUNCTION public.tercis_is_internal_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.profiles AS viewer
    WHERE viewer.id = (SELECT auth.uid())
      AND viewer.active IS TRUE
      AND (
        viewer.role IN ('admin','app_admin','company_admin')
        OR (viewer.role='collaborator' AND viewer.collaborator_type='internal')
      )
  );
$$;
REVOKE ALL ON FUNCTION public.tercis_is_internal_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tercis_is_internal_staff() TO authenticated;

DROP POLICY IF EXISTS "Timeline mirrors budget access" ON public.budget_timeline_events;
CREATE POLICY "Timeline respects client visibility and budget access"
  ON public.budget_timeline_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.budgets b
      WHERE b.id = budget_id AND b.company_id = budget_timeline_events.company_id
    )
    AND (
      visibility IN ('client','both')
      OR public.tercis_is_internal_staff()
    )
  );

DROP POLICY IF EXISTS "Attachments mirror budget access" ON public.budget_attachments;
CREATE POLICY "Attachments respect client visibility and budget access"
  ON public.budget_attachments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.budgets b
      WHERE b.id = budget_id AND b.company_id = budget_attachments.company_id
    )
    AND (
      visibility IN ('client','both')
      OR public.tercis_is_internal_staff()
    )
  );

DROP POLICY IF EXISTS "Messages mirror budget access" ON public.budget_messages;
CREATE POLICY "Messages respect client visibility and budget access"
  ON public.budget_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.budgets b
      WHERE b.id = budget_id AND b.company_id = budget_messages.company_id
    )
    AND (
      visibility IN ('client','both')
      OR public.tercis_is_internal_staff()
    )
  );

DROP POLICY IF EXISTS "Internal users insert timeline" ON public.budget_timeline_events;
CREATE POLICY "Only internal staff create verified timeline events"
  ON public.budget_timeline_events FOR INSERT TO authenticated
  WITH CHECK (
    public.tercis_is_internal_staff()
    AND actor_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.budgets b
      WHERE b.id = budget_id AND b.company_id = budget_timeline_events.company_id
    )
  );
