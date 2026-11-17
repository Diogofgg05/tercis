-- Customer quote views must be derived from the LAST PUBLISHED SNAPSHOT,
-- never a mutable draft or an internally rejected revision. In particular:
-- * sent_at is historical and remains populated after a revision returns to draft
-- * company_id can change during an internal revision
-- * clients may not see new prices or a new recipient before re-publication
-- No historical snapshots are invented for previously published quotes.
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

-- Until messaging gets its own publication/visibility events, restrict the
-- read-only client feed to messages present BEFORE the last published snapshot.
-- This fails closed on internal revision chatter incorrectly marked 'client'.
CREATE OR REPLACE FUNCTION public.tercis_client_message_feed()
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
    SELECT m.created_at AS sort_time,
      jsonb_build_object(
        'id',m.id,'budget_id',m.budget_id,'body',m.body,
        'visibility',m.visibility,'sender_id',m.sender_id,
        'channel',m.channel,'created_at',m.created_at
      ) AS entry
    FROM public.budget_messages m
    JOIN public.budgets b ON b.id=m.budget_id
    JOIN LATERAL (
      SELECT v.snapshot
      FROM public.budget_versions v
      WHERE v.budget_id=b.id AND v.snapshot->>'snapshot_kind'='sent_quote'
      ORDER BY v.version DESC LIMIT 1
    ) pub ON true
    WHERE b.organization_id=public.tercis_current_organization_id()
      AND (pub.snapshot->'budget'->>'company_id')::uuid=v_company
      AND m.company_id=v_company
      AND m.visibility IN ('client','both')
      AND m.created_at <= (pub.snapshot->'budget'->>'sent_at')::timestamptz
    ORDER BY m.created_at DESC LIMIT 200
  ) q;
  RETURN coalesce(v_data,'[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_client_message_feed() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_client_message_feed() TO authenticated;
