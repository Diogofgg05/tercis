/*
  Close the direct-status-update audit gap.

  Legacy PostgREST UPDATE could perform a valid transition without increasing
  the optimistic version or writing an audit row. Require version+1 for ANY
  status transition and move audit logging into a single database trigger.
  Both the authenticated RPC and a legacy direct UPDATE go through it.
*/
CREATE OR REPLACE FUNCTION public.tercis_guard_versioned_status()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
    AND NEW.version IS DISTINCT FROM OLD.version+1 THEN
    RAISE EXCEPTION 'Alterar o estado exige incrementar a versão do orçamento.'
      USING ERRCODE='40001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tercis_guard_versioned_status_update ON public.budgets;
CREATE TRIGGER tercis_guard_versioned_status_update
  BEFORE UPDATE OF status ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.tercis_guard_versioned_status();

CREATE OR REPLACE FUNCTION public.tercis_audit_status_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
BEGIN
  INSERT INTO public.audit_logs(company_id,actor_id,entity_type,entity_id,action,metadata)
  VALUES (NEW.company_id,auth.uid(),'budget',NEW.id,'status_changed',
    jsonb_build_object('from',OLD.status,'to',NEW.status,'version',NEW.version));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tercis_audit_status_change_update ON public.budgets;
CREATE TRIGGER tercis_audit_status_change_update
  AFTER UPDATE OF status ON public.budgets
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.tercis_audit_status_change();

REVOKE ALL ON FUNCTION public.tercis_guard_versioned_status()
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.tercis_audit_status_change()
  FROM PUBLIC,anon,authenticated;

-- Replace the RPC body solely to remove its duplicate INSERT audit logging.
CREATE OR REPLACE FUNCTION public.tercis_transition_budget(
  p_budget_id uuid,p_to text,p_expected_version integer
) RETURNS TABLE (id uuid, version integer, status text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text;
  v_kind text;
  v_company uuid;
  v_budget public.budgets%ROWTYPE;
  v_new_version integer;
BEGIN
  SELECT role,collaborator_type,company_id INTO v_role,v_kind,v_company
  FROM public.profiles AS p WHERE p.id=v_actor AND p.active IS TRUE;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Conta não autorizada.' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_budget FROM public.budgets b
  WHERE b.id=p_budget_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado.' USING ERRCODE='22023';
  END IF;
  IF v_budget.version IS DISTINCT FROM p_expected_version THEN
    RAISE EXCEPTION 'O orçamento foi alterado noutra sessão. Reabra-o antes de alterar o estado.'
      USING ERRCODE='40001';
  END IF;

  IF v_role='client' OR (v_role='collaborator' AND v_kind='client') THEN
    IF v_company IS NULL OR v_company IS DISTINCT FROM v_budget.company_id THEN
      RAISE EXCEPTION 'Sem acesso a este orçamento.' USING ERRCODE='42501';
    END IF;
  ELSIF v_role='collaborator' THEN
    IF v_budget.created_by IS DISTINCT FROM v_actor
       AND v_budget.assigned_to IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'O orçamento não está atribuído à sua conta.' USING ERRCODE='42501';
    END IF;
  ELSIF v_role='company_admin' THEN
    -- Current schema lacks an independent organisation_id. Until migrated,
    -- restrict even admins to the explicit company_id of the budget.
    IF v_company IS NULL OR v_company IS DISTINCT FROM v_budget.company_id THEN
      RAISE EXCEPTION 'O orçamento não pertence à sua empresa associada.'
        USING ERRCODE='42501';
    END IF;
  ELSIF v_role <> 'admin' THEN
    RAISE EXCEPTION 'Sem autorização para a transição.' USING ERRCODE='42501';
  END IF;

  IF NOT public.tercis_budget_can_move(v_budget.status,p_to,v_actor) THEN
    RAISE EXCEPTION 'Transição de estado não permitida.' USING ERRCODE='42501';
  END IF;

  UPDATE public.budgets b SET
    status=p_to,
    version=b.version+1,
    submitted_at=CASE WHEN p_to='pendente_aprovacao' THEN now() ELSE b.submitted_at END,
    approved_at=CASE WHEN p_to='aprovado' THEN now() ELSE b.approved_at END,
    sent_at=CASE WHEN p_to='enviado' THEN now() ELSE b.sent_at END,
    accepted_at=CASE WHEN p_to='aceite' THEN now() ELSE b.accepted_at END
  WHERE b.id=p_budget_id
  RETURNING b.version INTO v_new_version;

  -- Audit is now recorded by the AFTER UPDATE trigger for every valid path.
  RETURN QUERY SELECT p_budget_id,v_new_version,p_to;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_transition_budget(uuid,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_transition_budget(uuid,text,integer) TO authenticated;
