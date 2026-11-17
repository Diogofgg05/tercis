/*
  Client replies must refer to the CURRENT published proposal, not an
  old snapshot left visible in the history after re-assignments/revisions.
  The check is in a trigger so direct PostgREST UPDATE cannot bypass it.
*/
CREATE OR REPLACE FUNCTION public.tercis_guard_current_client_response()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE
  v_actor public.profiles%ROWTYPE;
  v_published record;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_actor FROM public.profiles p
    WHERE p.id=auth.uid() AND p.active IS TRUE;
  IF NOT FOUND OR NOT (
    v_actor.role='client' OR
    (v_actor.role='collaborator' AND v_actor.collaborator_type='client')
  ) THEN
    RETURN NEW;
  END IF;

  -- Existing workflow checks authorize which action a customer can request.
  -- This guard verifies that the exact commercial version is still current.
  IF OLD.status<>'enviado'
    OR NEW.status NOT IN ('aceite','rejeitado','pedido_alteracoes')
    OR v_actor.organization_id IS DISTINCT FROM OLD.organization_id
    OR v_actor.company_id IS DISTINCT FROM OLD.company_id THEN
    RAISE EXCEPTION 'Não pode responder a esta proposta.' USING ERRCODE='42501';
  END IF;

  SELECT v.version,
         (v.snapshot->'budget'->>'company_id')::uuid AS company_id,
         (v.snapshot->'budget'->>'sent_at')::timestamptz AS sent_at
    INTO v_published
  FROM public.budget_versions v
  WHERE v.budget_id=OLD.id
    AND v.snapshot->>'snapshot_kind'='sent_quote'
  ORDER BY v.version DESC LIMIT 1;

  IF v_published.version IS DISTINCT FROM OLD.version OR
     v_published.company_id IS DISTINCT FROM OLD.company_id OR
     v_published.sent_at IS DISTINCT FROM OLD.sent_at THEN
    RAISE EXCEPTION 'Esta versão já não está disponível para resposta. Consulte a proposta mais recente.'
      USING ERRCODE='42501';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tercis_guard_current_client_response ON public.budgets;
CREATE TRIGGER tercis_guard_current_client_response
  BEFORE UPDATE OF status ON public.budgets
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.tercis_guard_current_client_response();
REVOKE ALL ON FUNCTION public.tercis_guard_current_client_response()
  FROM PUBLIC,anon,authenticated;

-- Harden the privileged transition RPC as well: an old published customer
-- recipient may still be allowed to *view* the historic proposal, but cannot
-- respond to another customer's newly sent version.
