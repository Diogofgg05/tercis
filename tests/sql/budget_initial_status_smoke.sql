-- Authenticated users cannot bypass review by inserting a sent/approved quote.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
DO $$
DECLARE blocked boolean;
DECLARE quote_state text;
BEGIN
  FOREACH quote_state IN ARRAY ARRAY['enviado','aprovado','concluido','pendente_aprovacao']
  LOOP
    blocked:=false;
    BEGIN
      INSERT INTO public.budgets(id,ref,name,company_id,created_by,status)
      VALUES(gen_random_uuid(),'ORC-FORGED-'||quote_state,'Forged quote',NULL,
        '00000000-0000-4000-8000-000000000001',quote_state);
    EXCEPTION WHEN insufficient_privilege THEN blocked:=true;
    END;
    IF NOT blocked THEN
      RAISE EXCEPTION 'DIRECT INSERT BYPASSED WORKFLOW: %',quote_state;
    END IF;
  END LOOP;

  INSERT INTO public.budgets(id,ref,name,company_id,created_by,status)
  VALUES('00000000-0000-4000-8000-000000000240',
    'ORC-VALID-DRAFT','Valid new draft',NULL,
    '00000000-0000-4000-8000-000000000001','rascunho');

  SELECT status INTO quote_state FROM public.budgets
  WHERE id='00000000-0000-4000-8000-000000000240';
  IF quote_state IS DISTINCT FROM 'rascunho' THEN
    RAISE EXCEPTION 'CREATION OF AUTHORIZED DRAFT REGRESSED';
  END IF;
END $$;
ROLLBACK;
SELECT 'New quote initial-status safeguards PASSED' AS result;
