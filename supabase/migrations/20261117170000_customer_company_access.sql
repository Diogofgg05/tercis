/*
  Tighten the shared companies directory without claiming full tenant isolation.

  The 2026 legacy policy allowed ALL internal collaborators to SELECT ALL
  customer companies, including contact details. New restrictions expose only:
  - active approved legacy administrators: customer directory
  - active company_admin/client: their own linked company
  - active internal collaborators: companies of their own or assigned budgets.

  A collaborator could previously exploit the permissive budget INSERT policy
  to create a quote for an arbitrary company and then obtain its contact details.
  Until organisations and customer entities are separated, collaborator-created
  quotes start unassigned (company_id NULL); a legacy admin assigns the customer.

  SECURITY DEFINER lookup functions return booleans only. They do not expose
  contact details and avoid recursive RLS in the companies/budgets joins.
*/
CREATE OR REPLACE FUNCTION public.tercis_can_read_customer_company(
  p_company_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id=(SELECT auth.uid()) AND p.active IS TRUE
      AND (
        p.role='admin'
        OR (p.role IN ('company_admin','client') AND p.company_id=p_company_id)
        OR (
          p.role='collaborator' AND p.collaborator_type IS DISTINCT FROM 'client'
          AND (
            p.company_id=p_company_id
            OR EXISTS (
              SELECT 1 FROM public.budgets b
              WHERE b.company_id=p_company_id
                AND (b.created_by=p.id OR b.assigned_to=p.id)
            )
          )
        )
      )
  );
$$;
REVOKE ALL ON FUNCTION public.tercis_can_read_customer_company(uuid)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_can_read_customer_company(uuid)
  TO authenticated;

DROP POLICY IF EXISTS "Tercis customer company read scope" ON public.companies;
CREATE POLICY "Tercis customer company read scope"
  ON public.companies AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.tercis_can_read_customer_company(id));

-- Additional restrictive policy is ANDed with legacy INSERT policy.
DROP POLICY IF EXISTS "Tercis quote creation company guard" ON public.budgets;
CREATE POLICY "Tercis quote creation company guard"
  ON public.budgets AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id=(SELECT auth.uid()) AND p.active IS TRUE
        AND (
          p.role='admin'
          OR (
            p.role='collaborator'
            AND p.collaborator_type IS DISTINCT FROM 'client'
            AND created_by=p.id
            AND company_id IS NULL
            AND (assigned_to IS NULL OR assigned_to=p.id)
          )
        )
    )
  );

-- Prevent callers from rewriting ownership and customer association of a
-- collaborator's existing quote. A privileged admin may reassign it.
CREATE OR REPLACE FUNCTION public.tercis_guard_budget_ownership()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE v_role text;
DECLARE v_kind text;
BEGIN
  SELECT p.role,p.collaborator_type INTO v_role,v_kind
    FROM public.profiles p WHERE p.id=auth.uid() AND p.active IS TRUE;

  IF v_role='collaborator' THEN
    IF v_kind='client' THEN
      RAISE EXCEPTION 'Contas de clientes não podem alterar os campos comerciais.'
        USING ERRCODE='42501';
    END IF;
    IF NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.company_id IS DISTINCT FROM OLD.company_id
      OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
      RAISE EXCEPTION 'Apenas a administração pode alterar o cliente, o criador e a atribuição de um orçamento.'
        USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tercis_guard_budget_ownership_update ON public.budgets;
CREATE TRIGGER tercis_guard_budget_ownership_update
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.tercis_guard_budget_ownership();
REVOKE ALL ON FUNCTION public.tercis_guard_budget_ownership()
  FROM PUBLIC,anon,authenticated;
