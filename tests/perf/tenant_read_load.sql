-- Thirty concurrent CI clients exercise tenant-scoped SQL reads using RLS.
-- No writes and no production credentials.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
SET LOCAL request.jwt.claims='{"aal":"aal2"}';
SELECT id,ref,status,version FROM public.budgets
  ORDER BY created_at DESC,id DESC LIMIT 20;
SELECT code,description,unit_cost FROM public.custom_catalog_items
  WHERE active IS TRUE ORDER BY code LIMIT 20;
SELECT count(*) FROM public.quote_email_outbox
  WHERE state IN ('queued','processing','failed');
COMMIT;
