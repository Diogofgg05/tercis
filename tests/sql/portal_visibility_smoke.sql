-- A customer with access to their budget must NEVER see staff-only notes.
INSERT INTO auth.users (id,email,raw_user_meta_data)
VALUES ('00000000-0000-4000-8000-000000000004','customer@example.test','{}');
UPDATE public.profiles
SET role='client', active=true, company_id='00000000-0000-4000-8000-000000000100'
WHERE id='00000000-0000-4000-8000-000000000004';

INSERT INTO public.budget_timeline_events
  (budget_id,company_id,actor_id,type,title,visibility)
VALUES
  ('00000000-0000-4000-8000-000000000200','00000000-0000-4000-8000-000000000100',
   '00000000-0000-4000-8000-000000000001','message','Private staff note','internal'),
  ('00000000-0000-4000-8000-000000000200','00000000-0000-4000-8000-000000000100',
   '00000000-0000-4000-8000-000000000001','message','Public update','both');

INSERT INTO public.budget_messages
  (budget_id,company_id,sender_id,body,visibility)
VALUES
  ('00000000-0000-4000-8000-000000000200','00000000-0000-4000-8000-000000000100',
   '00000000-0000-4000-8000-000000000001','Internal price negotiation','internal'),
  ('00000000-0000-4000-8000-000000000200','00000000-0000-4000-8000-000000000100',
   '00000000-0000-4000-8000-000000000001','Quote submitted','client');

INSERT INTO public.budget_attachments
  (budget_id,company_id,uploaded_by,file_name,file_path,visibility)
VALUES
  ('00000000-0000-4000-8000-000000000200','00000000-0000-4000-8000-000000000100',
   '00000000-0000-4000-8000-000000000001','InternalCosts.xlsx','private/internal-costs.xlsx','internal'),
  ('00000000-0000-4000-8000-000000000200','00000000-0000-4000-8000-000000000100',
   '00000000-0000-4000-8000-000000000001','Quote.pdf','customer/quote.pdf','both');

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000004';
DO $$
DECLARE n integer;
DECLARE denied boolean := false;
BEGIN
  SELECT count(*) INTO n FROM public.budgets;
  IF n <> 0 THEN RAISE EXCEPTION 'RAW CUSTOMER BUDGET LEAK: %',n; END IF;
  SELECT count(*) INTO n FROM public.budget_timeline_events;
  IF n <> 0 THEN RAISE EXCEPTION 'RAW TIMELINE ACCESS SHOULD BE DENIED TO CLIENTS (% visible)',n; END IF;
  SELECT count(*) INTO n FROM public.budget_messages;
  IF n <> 0 THEN RAISE EXCEPTION 'RAW MESSAGES SHOULD USE REDACTED CLIENT FEED (% visible)',n; END IF;
  SELECT count(*) INTO n FROM public.budget_attachments;
  IF n <> 0 THEN RAISE EXCEPTION 'RAW ATTACHMENT ACCESS SHOULD BE DENIED (% visible)',n; END IF;

  BEGIN
    INSERT INTO public.budget_timeline_events
      (budget_id,company_id,actor_id,type,title,visibility)
    VALUES (
      '00000000-0000-4000-8000-000000000200',
      '00000000-0000-4000-8000-000000000100',
      '00000000-0000-4000-8000-000000000004',
      'message','Forged internal note','internal'
    );
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'CLIENT CAN INSERT INTERNAL TIMELINE'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.budget_timeline_events;
  IF n <> 2 THEN RAISE EXCEPTION 'ADMIN LOST PRIVATE TIMELINE ACCESS'; END IF;
  SELECT count(*) INTO n FROM public.budget_messages;
  IF n <> 2 THEN RAISE EXCEPTION 'ADMIN LOST PRIVATE MESSAGE ACCESS'; END IF;
  SELECT count(*) INTO n FROM public.budget_attachments;
  IF n <> 2 THEN RAISE EXCEPTION 'ADMIN LOST PRIVATE ATTACHMENT ACCESS'; END IF;
END $$;
ROLLBACK;

SELECT 'Client portal privacy tests PASSED' AS result;
