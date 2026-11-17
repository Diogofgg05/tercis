
-- Two independently owned organizations. The existing fixtures are organization A
-- (legacy). Organization B is created solely by the disposable test operator.
INSERT INTO public.organizations(id,slug,name)
VALUES('00000000-0000-4000-8000-000000000901','tenant-b','Tenant B');

INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('00000000-0000-4000-8000-000000000007','admin-b@example.test','{}'),
 ('00000000-0000-4000-8000-000000000008','client-b@example.test','{}');
UPDATE public.profiles SET
  role='admin',active=true,organization_id='00000000-0000-4000-8000-000000000901'
WHERE id='00000000-0000-4000-8000-000000000007';

INSERT INTO public.companies(id,name,created_by,organization_id)
VALUES('00000000-0000-4000-8000-000000000102','Customer of tenant B',
 '00000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000901');

UPDATE public.profiles SET
  role='client',active=true,
  organization_id='00000000-0000-4000-8000-000000000901',
  company_id='00000000-0000-4000-8000-000000000102'
WHERE id='00000000-0000-4000-8000-000000000008';

INSERT INTO public.budgets(
  id,ref,name,created_by,company_id,organization_id,status,sent_at,version
) VALUES (
 '00000000-0000-4000-8000-000000000280','B-2026-001','Private B quote',
 '00000000-0000-4000-8000-000000000007',
 '00000000-0000-4000-8000-000000000102',
 '00000000-0000-4000-8000-000000000901','enviado',now(),4
);
INSERT INTO public.budget_items(
  id,budget_id,code,description,quantity,unit_cost,margin
) VALUES (
 '00000000-0000-4000-8000-000000000380',
 '00000000-0000-4000-8000-000000000280',
 'TENANT-B-SECRET','Other organization price',1,999,40
);
INSERT INTO public.company_settings(company_id) VALUES
  ('00000000-0000-4000-8000-000000000102');
INSERT INTO public.customer_types(company_id,name) VALUES
  ('00000000-0000-4000-8000-000000000102','Only B');
INSERT INTO public.custom_catalog_items(
  code,description,unit_cost,created_by,organization_id
) VALUES(
  'PRIVATE-B','Only tenant B supplier price',9999,
  '00000000-0000-4000-8000-000000000007',
  '00000000-0000-4000-8000-000000000901'
);
INSERT INTO public.audit_logs(
  actor_id,organization_id,entity_type,action
) VALUES(
  '00000000-0000-4000-8000-000000000007',
  '00000000-0000-4000-8000-000000000901','tenant','created'
);
INSERT INTO public.budget_messages(
  budget_id,company_id,sender_id,body,visibility
) VALUES(
  '00000000-0000-4000-8000-000000000280',
  '00000000-0000-4000-8000-000000000102',
  '00000000-0000-4000-8000-000000000007',
  'B_PRIVATE_MESSAGE','client'
);

-- This trusted fixture represents a historical genuine publication: store
-- the same immutable sent snapshot the transition trigger normally creates.
INSERT INTO public.budget_versions(budget_id,version,snapshot,created_by)
SELECT b.id,b.version,jsonb_build_object(
  'budget',to_jsonb(b),
  'items',(SELECT jsonb_agg(to_jsonb(i) ORDER BY i.sort_order,i.id)
             FROM public.budget_items i WHERE i.budget_id=b.id),
  'snapshot_kind','sent_quote','captured_at',now()
),b.created_by
FROM public.budgets b
WHERE b.id='00000000-0000-4000-8000-000000000280';

-- A's trusted legacy administrator is NOT a platform superuser.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
DO $$
DECLARE n int; denied boolean;
BEGIN
  SELECT count(*) INTO n FROM public.companies
    WHERE id='00000000-0000-4000-8000-000000000102';
  IF n<>0 THEN RAISE EXCEPTION 'A reads B customer'; END IF;
  SELECT count(*) INTO n FROM public.profiles
    WHERE id IN ('00000000-0000-4000-8000-000000000007',
                 '00000000-0000-4000-8000-000000000008');
  IF n<>0 THEN RAISE EXCEPTION 'A reads B user profiles'; END IF;
  SELECT count(*) INTO n FROM public.budgets
    WHERE id='00000000-0000-4000-8000-000000000280';
  IF n<>0 THEN RAISE EXCEPTION 'A reads B quote'; END IF;
  SELECT count(*) INTO n FROM public.budget_items
    WHERE budget_id='00000000-0000-4000-8000-000000000280';
  IF n<>0 THEN RAISE EXCEPTION 'A reads B supplier costs'; END IF;
  SELECT count(*) INTO n FROM public.company_settings
    WHERE company_id='00000000-0000-4000-8000-000000000102';
  IF n<>0 THEN RAISE EXCEPTION 'A reads B settings'; END IF;
  SELECT count(*) INTO n FROM public.custom_catalog_items
    WHERE code='PRIVATE-B';
  IF n<>0 THEN RAISE EXCEPTION 'A reads B supplier catalog'; END IF;
  SELECT count(*) INTO n FROM public.audit_logs
    WHERE organization_id='00000000-0000-4000-8000-000000000901';
  IF n<>0 THEN RAISE EXCEPTION 'A reads B audit history'; END IF;
  SELECT count(*) INTO n FROM public.budget_messages
    WHERE body='B_PRIVATE_MESSAGE';
  IF n<>0 THEN RAISE EXCEPTION 'A reads B messages'; END IF;

  denied:=false;
  BEGIN
    PERFORM public.tercis_transition_budget(
      '00000000-0000-4000-8000-000000000280','aceite',4);
  EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'A transitioned B quote via privileged RPC'; END IF;

  denied:=false;
  BEGIN
    PERFORM public.tercis_admin_update_user(
      '00000000-0000-4000-8000-000000000008','collaborator',true,null);
  EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'A provisioned B user via privileged RPC'; END IF;

  denied:=false;
  BEGIN
    INSERT INTO public.budgets(ref,name,created_by,company_id)
    VALUES('FORGED-A-B','Forged cross-tenant',
       '00000000-0000-4000-8000-000000000001',
       '00000000-0000-4000-8000-000000000102');
  EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'A created budget for B customer'; END IF;

  denied:=false;
  BEGIN
    INSERT INTO public.budget_messages(budget_id,company_id,sender_id,body)
    VALUES('00000000-0000-4000-8000-000000000280',
      '00000000-0000-4000-8000-000000000102',
      '00000000-0000-4000-8000-000000000001','FORGED CROSS ORG');
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'A could forge B customer message'; END IF;
END $$;
ROLLBACK;

-- The B admin sees B-owned data, never A's private quote.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000007';
DO $$
DECLARE n int; denied boolean:=false;
BEGIN
  SELECT count(*) INTO n FROM public.budgets;
  IF n<>1 THEN RAISE EXCEPTION 'B sees unexpected quote count %',n; END IF;
  SELECT count(*) INTO n FROM public.companies;
  IF n<>1 THEN RAISE EXCEPTION 'B sees unexpected customer count %',n; END IF;
  SELECT count(*) INTO n FROM public.custom_catalog_items;
  IF n<>1 THEN RAISE EXCEPTION 'B sees unexpected catalog count %',n; END IF;
  SELECT count(*) INTO n FROM public.audit_logs;
  IF n<>1 THEN RAISE EXCEPTION 'B sees unexpected audit count %',n; END IF;
  BEGIN
    UPDATE public.budgets
      SET company_id='00000000-0000-4000-8000-000000000100'
      WHERE id='00000000-0000-4000-8000-000000000280';
  EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'B associated own quote to A customer'; END IF;
END $$;
ROLLBACK;

-- The B customer may read its published quote ONLY via the redacted RPC.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000008';
DO $$
DECLARE quotes jsonb; messages jsonb;
BEGIN
  SELECT public.tercis_client_quote_feed() INTO quotes;
  SELECT public.tercis_client_message_feed() INTO messages;
  IF jsonb_array_length(quotes)<>1 OR quotes::text NOT LIKE '%B-2026-001%'
      OR quotes::text LIKE '%ORC-TEST-001%' THEN
    RAISE EXCEPTION 'B client quote feed crossed tenant boundary: %',quotes;
  END IF;
  IF jsonb_array_length(messages)<>1 OR messages::text NOT LIKE '%B_PRIVATE_MESSAGE%' THEN
    RAISE EXCEPTION 'B client message feed not correctly tenant-scoped';
  END IF;
  IF quotes::text LIKE '%9999%' OR quotes::text LIKE '%unit_cost%' THEN
    RAISE EXCEPTION 'B customer sees wholesale cost details';
  END IF;
END $$;
ROLLBACK;

-- A's client must never see the quote from B via SECURITY DEFINER functions.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';
DO $$
DECLARE quotes jsonb; messages jsonb;
BEGIN
  SELECT public.tercis_client_quote_feed() INTO quotes;
  SELECT public.tercis_client_message_feed() INTO messages;
  IF quotes::text LIKE '%B-2026-001%' OR messages::text LIKE '%B_PRIVATE_MESSAGE%' THEN
    RAISE EXCEPTION 'A customer feed exposed other tenant';
  END IF;
END $$;
ROLLBACK;

SELECT 'Tercis two-organization RLS, RPC and cross-tenant access tests PASSED' AS result;
