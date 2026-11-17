-- Real commercial history: preserve the exact quote sent to a customer.
-- Unlike the mutable budget table, snapshots are private, append-only records.
-- Historical already-sent quotes are NOT backfilled using current prices,
-- because that would misrepresent what a customer originally received.
CREATE OR REPLACE FUNCTION public.tercis_snapshot_sent_quote()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_items jsonb;
BEGIN
  IF NEW.status='enviado' AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(i) ORDER BY i.sort_order,i.id),'[]'::jsonb)
      INTO v_items
    FROM public.budget_items AS i WHERE i.budget_id=NEW.id;
    INSERT INTO public.budget_versions(budget_id,version,snapshot,created_by)
    VALUES (
      NEW.id,NEW.version,
      jsonb_build_object(
        'budget',to_jsonb(NEW),
        'items',v_items,
        'snapshot_kind','sent_quote',
        'captured_at',now()
      ),auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tercis_snapshot_sent_quote ON public.budgets;
CREATE TRIGGER tercis_snapshot_sent_quote
  AFTER UPDATE OF status ON public.budgets
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status='enviado')
  EXECUTE FUNCTION public.tercis_snapshot_sent_quote();
REVOKE ALL ON FUNCTION public.tercis_snapshot_sent_quote() FROM PUBLIC,anon,authenticated;

-- Snapshots contain internal purchase costs: absolutely no customer read policy.
-- This SELECT policy is combined with the existing restrictive tenant and
-- verified MFA policies; it does not permit cross-tenant access.
DROP POLICY IF EXISTS "Tercis managers read own sent quote snapshots" ON public.budget_versions;
CREATE POLICY "Tercis managers read own sent quote snapshots"
  ON public.budget_versions FOR SELECT TO authenticated
  USING (public.tercis_is_org_admin());

-- Every business owns its own reference space, without collisions with other
-- organizations. The original global UNIQUE(ref) defeats independent tenants.
ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS budgets_ref_key;
ALTER TABLE public.budgets
  ADD CONSTRAINT tercis_budget_organization_reference_unique
  UNIQUE(organization_id,ref);
