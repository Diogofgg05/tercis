/*
  Email delivery outbox. Publishing a quote in the portal is NOT email delivery.
  Only an authorized sender can enqueue a current published snapshot; a service
  worker must explicitly send it via a verified provider and record outcomes.
  Clients have no raw access to outbox addresses, statuses or credentials.
*/
CREATE TABLE public.quote_email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  budget_id uuid NOT NULL REFERENCES public.budgets(id),
  published_version integer NOT NULL,
  recipient_email text NOT NULL,
  state text NOT NULL DEFAULT 'queued'
    CHECK (state IN ('queued','processing','accepted','delivered','bounced','failed')),
  provider_id text UNIQUE,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 10),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  delivered_at timestamptz,
  UNIQUE(budget_id,published_version,recipient_email)
);
CREATE INDEX tercis_quote_email_claim_idx
  ON public.quote_email_outbox(state,next_attempt_at,created_at)
  WHERE state IN ('queued','failed');
CREATE INDEX tercis_quote_email_org_idx
  ON public.quote_email_outbox(organization_id,budget_id,created_at DESC);
ALTER TABLE public.quote_email_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quote_email_outbox FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.quote_email_outbox TO authenticated;
CREATE POLICY "Tercis authorized managers read own quote delivery"
  ON public.quote_email_outbox FOR SELECT TO authenticated USING (
    organization_id=public.tercis_current_organization_id()
    AND public.tercis_is_org_admin()
    AND public.tercis_verified_aal2()
  );

CREATE OR REPLACE FUNCTION public.tercis_queue_quote_email(
  p_budget_id uuid,p_expected_version integer
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_actor uuid:=auth.uid(); v_org uuid; v_id uuid;
DECLARE v_record public.budgets%ROWTYPE; v_email text; v_snapshot jsonb;
BEGIN
  SELECT p.organization_id INTO v_org
  FROM public.profiles p WHERE p.id=v_actor AND p.active IS TRUE
    AND p.role IN ('admin','company_admin');
  IF v_org IS NULL OR NOT public.tercis_verified_aal2() THEN
    RAISE EXCEPTION 'O envio de propostas exige um administrador com MFA.'
      USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_record FROM public.budgets b WHERE b.id=p_budget_id FOR UPDATE;
  IF NOT FOUND OR v_record.organization_id IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'Proposta fora da organização.' USING ERRCODE='42501';
  END IF;
  IF v_record.status<>'enviado' OR v_record.version IS DISTINCT FROM p_expected_version
    OR v_record.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Só a versão atual publicada e não arquivada pode ser enviada.'
      USING ERRCODE='40001';
  END IF;
  SELECT v.snapshot INTO v_snapshot FROM public.budget_versions v
    WHERE v.budget_id=p_budget_id AND v.version=p_expected_version
      AND v.snapshot->>'snapshot_kind'='sent_quote';
  IF v_snapshot IS NULL OR
    (v_snapshot->'budget'->>'company_id')::uuid IS DISTINCT FROM v_record.company_id
  THEN RAISE EXCEPTION 'Não existe fotografia publicada válida desta proposta.'
    USING ERRCODE='42501'; END IF;
  SELECT lower(btrim(c.email)) INTO v_email FROM public.companies c
    WHERE c.id=v_record.company_id AND c.organization_id=v_org;
  IF v_email IS NULL OR v_email !~ '^[^ @]+@[^ @]+[.][^ @]+$' THEN
    RAISE EXCEPTION 'O cliente precisa de um email válido antes de enviar.'
      USING ERRCODE='22023';
  END IF;
  INSERT INTO public.quote_email_outbox (
    organization_id,budget_id,published_version,recipient_email,created_by
  ) VALUES(v_org,p_budget_id,p_expected_version,v_email,v_actor)
  ON CONFLICT (budget_id,published_version,recipient_email)
  DO UPDATE SET updated_at=public.quote_email_outbox.updated_at
  RETURNING id INTO v_id;
  INSERT INTO public.audit_logs (
    organization_id,company_id,actor_id,entity_type,entity_id,action,metadata
  ) VALUES(v_org,v_record.company_id,v_actor,'budget',p_budget_id,
    'quote_email_queued',jsonb_build_object('outbox_id',v_id,
    'published_version',p_expected_version));
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_queue_quote_email(uuid,integer)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_queue_quote_email(uuid,integer)
  TO authenticated;

-- Claim in short transactions and execute provider API OUTSIDE PostgreSQL.
-- Service role only: no authenticated or anonymous execution.
CREATE OR REPLACE FUNCTION public.tercis_claim_quote_email_jobs(p_limit integer DEFAULT 10)
RETURNS TABLE (
  id uuid,budget_id uuid,published_version integer,recipient_email text,
  snapshot jsonb
) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Apenas o serviço de entregas pode reclamar mensagens.'
      USING ERRCODE='42501';
  END IF;
  RETURN QUERY
  WITH picked AS (
    SELECT q.id FROM public.quote_email_outbox q
    WHERE q.state IN ('queued','failed') AND q.next_attempt_at<=now()
      AND q.attempt_count<5
    ORDER BY q.created_at ASC
    FOR UPDATE SKIP LOCKED LIMIT greatest(1,least(coalesce(p_limit,10),50))
  ), claimed AS (
    UPDATE public.quote_email_outbox q
    SET state='processing',attempt_count=q.attempt_count+1,updated_at=now()
    FROM picked p WHERE p.id=q.id
    RETURNING q.*
  )
  SELECT c.id,c.budget_id,c.published_version,c.recipient_email,v.snapshot
  FROM claimed c JOIN public.budget_versions v ON
    v.budget_id=c.budget_id AND v.version=c.published_version
      AND v.snapshot->>'snapshot_kind'='sent_quote';
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_claim_quote_email_jobs(integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tercis_claim_quote_email_jobs(integer)
  TO service_role;

-- Full state updates and provider callbacks are performed by the service role,
-- which bypasses RLS. Provider webhooks must be signature verified and idempotent.
