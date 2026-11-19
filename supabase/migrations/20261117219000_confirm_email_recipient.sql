-- Human approval must match the actual recipient chosen from the tenant's
-- current customer directory. Do not silently deliver a quote to a stale
-- different company email or an arbitrary contact address.
CREATE OR REPLACE FUNCTION public.tercis_queue_quote_email(
  p_budget_id uuid,p_expected_version integer,p_confirmed_recipient text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_real_email text; v_actor_org uuid; v_id uuid;
BEGIN
  SELECT p.organization_id INTO v_actor_org
  FROM public.profiles p WHERE p.id=auth.uid() AND p.active IS TRUE
    AND p.role IN ('admin','company_admin');
  IF v_actor_org IS NULL OR NOT public.tercis_verified_aal2() THEN
    RAISE EXCEPTION 'Envio exige administrador da organização com MFA.'
      USING ERRCODE='42501';
  END IF;
  SELECT lower(btrim(c.email)) INTO v_real_email
  FROM public.budgets b JOIN public.companies c
    ON c.id=b.company_id AND c.organization_id=b.organization_id
  WHERE b.id=p_budget_id AND b.organization_id=v_actor_org;
  IF v_real_email IS NULL OR v_real_email='' OR
    v_real_email IS DISTINCT FROM lower(btrim(coalesce(p_confirmed_recipient,''))) THEN
    RAISE EXCEPTION 'O email de destino mudou. Atualize a ficha da empresa e confirme o destinatário.'
      USING ERRCODE='40001';
  END IF;
  -- Legacy two-argument RPC is now server-only; it performs transactional
  -- version/snapshot verification, audit and idempotent enqueue.
  v_id:=public.tercis_queue_quote_email(p_budget_id,p_expected_version);
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_queue_quote_email(uuid,integer)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.tercis_queue_quote_email(uuid,integer,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_queue_quote_email(uuid,integer,text)
  TO authenticated;
