/*
  Archive instead of destructively deleting commercial quotes.
  Service role can restore via audited RPC; ordinary sessions cannot directly
  edit an archived quote or its items. Sent client snapshots are preserved.
*/
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS tercis_budgets_archived_org_idx
  ON public.budgets(organization_id,archived_at,created_at DESC);

CREATE OR REPLACE FUNCTION public.tercis_set_budget_archive(
  p_budget_id uuid,p_expected_version integer,p_archive boolean
) RETURNS TABLE(id uuid,version integer,archived_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor uuid:=auth.uid(); v_org uuid; v_role text;
DECLARE v_record public.budgets%ROWTYPE;
BEGIN
  SELECT p.organization_id,p.role INTO v_org,v_role
  FROM public.profiles p WHERE p.id=v_actor AND p.active IS TRUE
    AND p.role IN ('admin','company_admin');
  IF v_org IS NULL OR NOT public.tercis_verified_aal2() THEN
    RAISE EXCEPTION 'Arquivar e recuperar exige administração autenticada com MFA.'
      USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_record FROM public.budgets b WHERE b.id=p_budget_id FOR UPDATE;
  IF NOT FOUND OR v_record.organization_id IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'Orçamento não encontrado nesta organização.' USING ERRCODE='42501';
  END IF;
  IF p_expected_version IS DISTINCT FROM v_record.version THEN
    RAISE EXCEPTION 'A proposta foi modificada. Recarregue a versão atual.'
      USING ERRCODE='40001';
  END IF;
  IF (v_record.archived_at IS NOT NULL)=p_archive THEN
    RAISE EXCEPTION 'O orçamento já está neste estado de arquivo.'
      USING ERRCODE='22023';
  END IF;
  UPDATE public.budgets b
  SET archived_at=CASE WHEN p_archive THEN now() ELSE NULL END,
      archived_by=CASE WHEN p_archive THEN v_actor ELSE NULL END,
      version=b.version+1
  WHERE b.id=p_budget_id
  RETURNING b.* INTO v_record;
  INSERT INTO public.audit_logs (
    organization_id,company_id,actor_id,entity_type,entity_id,action,metadata
  ) VALUES (
    v_org,v_record.company_id,v_actor,'budget',p_budget_id,
    CASE WHEN p_archive THEN 'quote_archived' ELSE 'quote_restored' END,
    jsonb_build_object('version',v_record.version)
  );
  RETURN QUERY SELECT v_record.id,v_record.version,v_record.archived_at;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_set_budget_archive(uuid,integer,boolean)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_set_budget_archive(uuid,integer,boolean)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.tercis_guard_archived_quote()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
BEGIN
  IF OLD.archived_at IS NOT NULL
    AND (
      NEW.status IS DISTINCT FROM OLD.status
      OR NEW.ref IS DISTINCT FROM OLD.ref
      OR NEW.name IS DISTINCT FROM OLD.name
      OR NEW.company_id IS DISTINCT FROM OLD.company_id
      OR NEW.date IS DISTINCT FROM OLD.date
      OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
      OR NEW.notes IS DISTINCT FROM OLD.notes
    ) THEN
    RAISE EXCEPTION 'O orçamento arquivado é apenas de leitura.'
      USING ERRCODE='42501';
  END IF;
  IF auth.uid() IS NOT NULL
    AND NEW.archived_at IS DISTINCT FROM OLD.archived_at
    AND current_setting('tercis.archive_rpc',true) IS DISTINCT FROM 'authorized' THEN
    RAISE EXCEPTION 'Use o processo auditado de arquivo.'
      USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tercis_guard_archived_quote_write ON public.budgets;
CREATE TRIGGER tercis_guard_archived_quote_write
  BEFORE UPDATE ON public.budgets FOR EACH ROW
  EXECUTE FUNCTION public.tercis_guard_archived_quote();

-- The privileged archive RPC sets an explicit transaction-local context.
CREATE OR REPLACE FUNCTION public.tercis_set_budget_archive(
  p_budget_id uuid,p_expected_version integer,p_archive boolean
) RETURNS TABLE(id uuid,version integer,archived_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor uuid:=auth.uid(); v_org uuid;
DECLARE v_record public.budgets%ROWTYPE;
BEGIN
  SELECT p.organization_id INTO v_org
  FROM public.profiles p WHERE p.id=v_actor AND p.active IS TRUE
    AND p.role IN ('admin','company_admin');
  IF v_org IS NULL OR NOT public.tercis_verified_aal2() THEN
    RAISE EXCEPTION 'Arquivar e recuperar exige administração com MFA.'
      USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_record FROM public.budgets b WHERE b.id=p_budget_id FOR UPDATE;
  IF NOT FOUND OR v_record.organization_id IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'Orçamento fora da organização.' USING ERRCODE='42501';
  END IF;
  IF p_expected_version IS DISTINCT FROM v_record.version THEN
    RAISE EXCEPTION 'Versão desatualizada: recarregue o orçamento.'
      USING ERRCODE='40001';
  END IF;
  IF (v_record.archived_at IS NOT NULL)=p_archive THEN
    RAISE EXCEPTION 'O orçamento já se encontra nesse estado.'
      USING ERRCODE='22023';
  END IF;
  PERFORM set_config('tercis.archive_rpc','authorized',true);
  UPDATE public.budgets b
  SET archived_at=CASE WHEN p_archive THEN now() ELSE NULL END,
      archived_by=CASE WHEN p_archive THEN v_actor ELSE NULL END,
      version=b.version+1
  WHERE b.id=p_budget_id
  RETURNING b.* INTO v_record;
  PERFORM set_config('tercis.archive_rpc','',true);
  INSERT INTO public.audit_logs(
    organization_id,company_id,actor_id,entity_type,entity_id,action,metadata
  ) VALUES(v_org,v_record.company_id,v_actor,'budget',p_budget_id,
    CASE WHEN p_archive THEN 'quote_archived' ELSE 'quote_restored' END,
    jsonb_build_object('version',v_record.version));
  RETURN QUERY SELECT v_record.id,v_record.version,v_record.archived_at;
END;
$$;

DROP POLICY IF EXISTS "Tercis block direct archived commercial edits" ON public.budgets;
CREATE POLICY "Tercis block direct archived commercial edits" ON public.budgets
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (archived_at IS NULL) WITH CHECK (archived_at IS NULL);
DROP POLICY IF EXISTS "Tercis block direct archived quote deletion" ON public.budgets;
CREATE POLICY "Tercis block direct archived quote deletion" ON public.budgets
  AS RESTRICTIVE FOR DELETE TO authenticated USING (archived_at IS NULL);

DROP POLICY IF EXISTS "Tercis disallow edits to archived lines" ON public.budget_items;
CREATE POLICY "Tercis disallow edits to archived lines" ON public.budget_items
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (EXISTS(SELECT 1 FROM public.budgets b
    WHERE b.id=budget_id AND b.archived_at IS NULL))
  WITH CHECK (EXISTS(SELECT 1 FROM public.budgets b
    WHERE b.id=budget_id AND b.archived_at IS NULL));
-- A FOR ALL restrictive policy also blocks SELECT of archived lines, which
-- is not desired for read-only history. Replace with operation-specific rules.
DROP POLICY "Tercis disallow edits to archived lines" ON public.budget_items;
CREATE POLICY "Tercis block new lines for archived quotes" ON public.budget_items
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS(SELECT 1 FROM public.budgets b
    WHERE b.id=budget_id AND b.archived_at IS NULL));
CREATE POLICY "Tercis block line updates for archived quotes" ON public.budget_items
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (EXISTS(SELECT 1 FROM public.budgets b
    WHERE b.id=budget_id AND b.archived_at IS NULL))
  WITH CHECK (EXISTS(SELECT 1 FROM public.budgets b
    WHERE b.id=budget_id AND b.archived_at IS NULL));
CREATE POLICY "Tercis block line deletes for archived quotes" ON public.budget_items
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (EXISTS(SELECT 1 FROM public.budgets b
    WHERE b.id=budget_id AND b.archived_at IS NULL));
