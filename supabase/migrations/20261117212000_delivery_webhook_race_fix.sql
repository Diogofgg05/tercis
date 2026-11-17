-- Provider events may reach the webhook before the worker has persisted
-- the provider message ID. Keep unmatched signed events and reconcile them
-- atomically as soon as the worker registers the provider ID.
ALTER TABLE public.quote_email_webhook_events
  ADD COLUMN IF NOT EXISTS applied_at timestamptz;
ALTER TABLE public.quote_email_webhook_events
  ADD COLUMN IF NOT EXISTS outbox_id uuid REFERENCES public.quote_email_outbox(id);
GRANT UPDATE ON public.quote_email_webhook_events TO service_role;

-- A provider-accepted message is NEVER eligible for automatic retry.
-- Retry is only for a job that has no confirmed provider identifier.
CREATE OR REPLACE FUNCTION public.tercis_claim_quote_email_jobs(p_limit integer DEFAULT 10)
RETURNS TABLE(
  id uuid,budget_id uuid,published_version integer,recipient_email text,
  snapshot jsonb,attempt_count integer
) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Apenas o serviço de entregas pode reclamar mensagens.'
      USING ERRCODE='42501';
  END IF;
  RETURN QUERY
  WITH picked AS (
    SELECT q.id FROM public.quote_email_outbox q
    WHERE q.provider_id IS NULL
      AND ((q.state IN ('queued','failed') AND q.next_attempt_at<=now())
        OR (q.state='processing' AND q.updated_at<now()-interval '20 minutes'))
      AND q.attempt_count<5
    ORDER BY q.created_at ASC
    FOR UPDATE SKIP LOCKED LIMIT greatest(1,least(coalesce(p_limit,10),50))
  ), claimed AS (
    UPDATE public.quote_email_outbox q
    SET state='processing',attempt_count=q.attempt_count+1,updated_at=now()
    FROM picked p WHERE p.id=q.id
    RETURNING q.*
  )
  SELECT c.id,c.budget_id,c.published_version,c.recipient_email,v.snapshot,c.attempt_count
  FROM claimed c JOIN public.budget_versions v
    ON v.budget_id=c.budget_id AND v.version=c.published_version
    AND v.snapshot->>'snapshot_kind'='sent_quote';
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_claim_quote_email_jobs(integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tercis_claim_quote_email_jobs(integer)
  TO service_role;

-- Apply an authenticated provider signal to a locked outbox row.
-- This is never exposed as a callable public API.
CREATE OR REPLACE FUNCTION public.tercis_apply_email_delivery_event(
  p_outbox_id uuid,p_event_type text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Evento não autorizado.' USING ERRCODE='42501';
  END IF;
  UPDATE public.quote_email_outbox q SET
    state=CASE
      WHEN q.state IN ('delivered','bounced') THEN q.state
      WHEN p_event_type='email.delivered' THEN 'delivered'
      WHEN p_event_type='email.bounced' THEN 'bounced'
      WHEN p_event_type='email.failed' THEN 'failed'
      WHEN q.state='failed' AND q.provider_id IS NOT NULL THEN q.state
      ELSE 'accepted'
    END,
    accepted_at=CASE WHEN p_event_type IN ('email.sent','email.delivered')
      THEN coalesce(q.accepted_at,now()) ELSE q.accepted_at END,
    delivered_at=CASE WHEN p_event_type='email.delivered'
      THEN coalesce(q.delivered_at,now()) ELSE q.delivered_at END,
    last_error=CASE WHEN p_event_type IN ('email.bounced','email.failed')
      THEN p_event_type ELSE q.last_error END,
    updated_at=now()
  WHERE q.id=p_outbox_id;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_apply_email_delivery_event(uuid,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tercis_apply_email_delivery_event(uuid,text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.tercis_record_quote_email_event(
  p_event_id text,p_provider_id text,p_event_type text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_outbox uuid; v_inserted text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Eventos de entrega exigem serviço confiável.'
      USING ERRCODE='42501';
  END IF;
  IF p_event_id IS NULL OR length(p_event_id)>256 OR
     p_provider_id IS NULL OR length(p_provider_id)>256 OR
     p_event_type NOT IN ('email.sent','email.delivered','email.bounced','email.failed') THEN
    RAISE EXCEPTION 'Evento de entrega inválido.' USING ERRCODE='22023';
  END IF;
  -- Preserve events even when provider ID has not been committed yet.
  INSERT INTO public.quote_email_webhook_events(event_id,provider_id,event_type)
    VALUES(p_event_id,p_provider_id,p_event_type)
    ON CONFLICT(event_id) DO NOTHING RETURNING event_id INTO v_inserted;
  IF v_inserted IS NULL THEN RETURN false; END IF;

  SELECT id INTO v_outbox FROM public.quote_email_outbox
    WHERE provider_id=p_provider_id FOR UPDATE;
  IF v_outbox IS NOT NULL THEN
    PERFORM public.tercis_apply_email_delivery_event(v_outbox,p_event_type);
    UPDATE public.quote_email_webhook_events
      SET applied_at=now(),outbox_id=v_outbox WHERE event_id=p_event_id;
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_record_quote_email_event(text,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tercis_record_quote_email_event(text,text,text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.tercis_register_quote_email_provider(
  p_outbox_id uuid,p_provider_id text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_state text; v_event record;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Apenas o serviço pode confirmar o fornecedor.'
      USING ERRCODE='42501';
  END IF;
  IF p_provider_id IS NULL OR btrim(p_provider_id)='' OR length(p_provider_id)>256 THEN
    RAISE EXCEPTION 'Identificador de fornecedor inválido.' USING ERRCODE='22023';
  END IF;
  -- An idempotent callback after a timeout must not downgrade delivery state.
  UPDATE public.quote_email_outbox q SET
    provider_id=coalesce(q.provider_id,p_provider_id),
    state=CASE WHEN q.state='processing' THEN 'accepted' ELSE q.state END,
    accepted_at=coalesce(q.accepted_at,now()),updated_at=now(),last_error=NULL
  WHERE q.id=p_outbox_id AND (q.provider_id IS NULL OR q.provider_id=p_provider_id)
    AND q.state IN ('processing','accepted','delivered','bounced','failed')
  RETURNING q.state INTO v_state;
  IF v_state IS NULL THEN
    RAISE EXCEPTION 'Trabalho inexistente ou fornecedor incompatível.'
      USING ERRCODE='42501';
  END IF;
  -- Replay all early signed events, including delivery, before returning.
  FOR v_event IN SELECT e.event_id,e.event_type
    FROM public.quote_email_webhook_events e
    WHERE e.provider_id=p_provider_id AND e.applied_at IS NULL
    ORDER BY CASE e.event_type
      WHEN 'email.sent' THEN 1 WHEN 'email.failed' THEN 2
      WHEN 'email.bounced' THEN 3 WHEN 'email.delivered' THEN 4 ELSE 0 END,
      e.received_at,e.event_id
    FOR UPDATE
  LOOP
    PERFORM public.tercis_apply_email_delivery_event(p_outbox_id,v_event.event_type);
    UPDATE public.quote_email_webhook_events SET
      applied_at=now(),outbox_id=p_outbox_id WHERE event_id=v_event.event_id;
  END LOOP;
  SELECT q.state INTO v_state FROM public.quote_email_outbox q WHERE q.id=p_outbox_id;
  RETURN v_state;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_register_quote_email_provider(uuid,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tercis_register_quote_email_provider(uuid,text)
  TO service_role;

CREATE INDEX IF NOT EXISTS tercis_pending_delivery_events
  ON public.quote_email_webhook_events(provider_id,received_at)
  WHERE applied_at IS NULL;
