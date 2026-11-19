BEGIN;
INSERT INTO public.organizations(id,slug,name) VALUES('10000000-0000-4000-8000-000000000001','example-guard-tests','Example tests');
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('20000000-0000-4000-8000-000000000001','example-guard@example.test','{}');
UPDATE public.profiles SET role='company_admin',active=true,organization_id='10000000-0000-4000-8000-000000000001'
WHERE id='20000000-0000-4000-8000-000000000001';
INSERT INTO public.companies(id,name,is_example,organization_id,created_by) VALUES
 ('30000000-0000-4000-8000-000000000001','[Demonstração] Test company',true,'10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001'),
 ('30000000-0000-4000-8000-000000000002','Real fixture company',false,'10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001');
INSERT INTO public.budgets(id,ref,name,company_id,created_by,organization_id,is_example) VALUES
 ('40000000-0000-4000-8000-000000000001','TEST-DEMO-GUARD','[Demonstração] Test quote','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',true),
 ('40000000-0000-4000-8000-000000000002','TEST-REAL-GUARD','Real fixture quote','30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',false);
INSERT INTO public.budget_items(budget_id,description,quantity,unit_cost,margin) VALUES
 ('40000000-0000-4000-8000-000000000001','Illustrative',1,1000,0),
 ('40000000-0000-4000-8000-000000000002','Real fixture',1,10,0);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"aal":"aal2","sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
DO $$ DECLARE kpis jsonb; reports jsonb; BEGIN
 IF (SELECT count(*) FROM public.budgets)<>2 THEN RAISE EXCEPTION 'Examples absent from quote table'; END IF;
 kpis:=public.tercis_dashboard_kpis();reports:=public.tercis_report_summary(6);
 IF (kpis->>'quote_count')::int<>1 OR (kpis->>'quote_volume')::numeric<>10 OR (kpis->>'companies_count')::int<>1 THEN RAISE EXCEPTION 'Examples contaminated KPIs'; END IF;
 IF (reports->>'count')::int<>1 OR (reports->>'value')::numeric<>10 THEN RAISE EXCEPTION 'Examples contaminated financial report'; END IF;
 BEGIN
  UPDATE public.budgets SET status='pendente_aprovacao',version=version+1 WHERE id='40000000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'Sample was submitted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  UPDATE public.budgets SET is_example=false WHERE id='40000000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'Sample marker removed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT 'Examples remain drafts, cannot become real quotes and are excluded from finance: passed' AS verification;
ROLLBACK;
