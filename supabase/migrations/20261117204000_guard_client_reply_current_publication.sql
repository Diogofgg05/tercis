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

CREATE OR REPLACE FUNCTION public.tercis_client_quote_feed()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_company uuid; v_data jsonb;
BEGIN
  v_company:=public.tercis_current_client_company();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Esta operação é exclusiva de clientes ativos associados a uma empresa.'
      USING ERRCODE='42501';
  END IF;

  SELECT coalesce(jsonb_agg(entry ORDER BY sort_time DESC),'[]'::jsonb) INTO v_data
  FROM (
    SELECT b.created_at AS sort_time,
      jsonb_build_object(
        'id',b.id,
        'ref',pub.header->>'ref',
        'name',pub.header->>'name',
        'company_id',(pub.header->>'company_id')::uuid,
        'company',jsonb_build_object('id',c.id,'name',c.name),
        'assigned_to',NULL,
        -- Never show internal review status of an unpublished new revision.
        'status',CASE
          WHEN pub.version < (
            SELECT max(v_new.version) FROM public.budget_versions v_new
            WHERE v_new.budget_id=b.id
              AND v_new.snapshot->>'snapshot_kind'='sent_quote'
          ) THEN 'enviado'
          WHEN b.status IN ('aceite','em_execucao','concluido','expirado') THEN b.status
          WHEN b.status IN ('rejeitado','pedido_alteracoes')
             AND evt.from_status='enviado' THEN b.status
          ELSE 'enviado' END,
        'sector',pub.header->>'sector',
        'date',pub.header->>'date',
        'valid_until',pub.header->>'valid_until',
        'sent_at',pub.header->>'sent_at',
        'notes','','client_contact','','client_email','',
        'include_tax',(pub.header->>'include_tax')::boolean,
        'tax_rate',(pub.header->>'tax_rate')::numeric,
        'version',pub.version,
        'can_respond',
          b.status='enviado'
          AND b.version=pub.version
          AND b.company_id=(pub.header->>'company_id')::uuid
          AND b.sent_at=(pub.header->>'sent_at')::timestamptz
          AND (pub.header->>'valid_until')::date >= CURRENT_DATE,
        'created_at',pub.header->>'created_at',
        'updated_at',pub.header->>'updated_at',
        'items',coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'id',line->>'id',
            'budget_id',b.id,
            'code',line->>'code',
            'description',line->>'description',
            'reference',line->>'reference',
            'unit',line->>'unit',
            'quantity',(line->>'quantity')::numeric,
            'unit_price',round(
              coalesce((line->>'unit_cost')::numeric,0) *
              (1+coalesce((line->>'margin')::numeric,0)/100) *
              (1-coalesce((line->>'discount')::numeric,0)/100),4
            ),
            'sort_order',(line->>'sort_order')::integer
          ) ORDER BY (line->>'sort_order')::integer)
          FROM jsonb_array_elements(pub.snapshot->'items') AS lines(line)
        ),'[]'::jsonb)
      ) AS entry
    FROM public.budgets b
    JOIN LATERAL (
      SELECT v.version,v.snapshot,v.snapshot->'budget' AS header
      FROM public.budget_versions v
      WHERE v.budget_id=b.id
        AND v.snapshot->>'snapshot_kind'='sent_quote'
        AND (v.snapshot->'budget'->>'company_id')::uuid=v_company
      ORDER BY v.version DESC LIMIT 1
    ) pub ON true
    JOIN public.companies c
      ON c.id=(pub.header->>'company_id')::uuid
      AND c.organization_id=b.organization_id
    LEFT JOIN LATERAL (
      SELECT a.metadata->>'from' AS from_status
      FROM public.audit_logs a
      WHERE a.entity_type='budget' AND a.entity_id=b.id
        AND a.action='status_changed'
      ORDER BY (a.metadata->>'version')::integer DESC NULLS LAST, a.created_at DESC
      LIMIT 1
    ) evt ON true
    WHERE b.organization_id=public.tercis_current_organization_id()
      AND (pub.header->>'company_id')::uuid=v_company
    ORDER BY b.created_at DESC LIMIT 500
  ) q;
  RETURN coalesce(v_data,'[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_client_quote_feed() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_client_quote_feed() TO authenticated;
