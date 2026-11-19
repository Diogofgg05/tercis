-- Fictitious records explicitly authorized by the user. No real contacts or Auth users.
-- Every price below is illustrative, unrelated to a manufacturer's price or a purchase cost.
BEGIN;
WITH target AS (SELECT p.id,p.organization_id FROM public.profiles p JOIN public.organizations o ON o.id=p.organization_id WHERE o.slug='tercis-legacy' AND p.active IS TRUE AND p.role IN ('admin','company_admin') ORDER BY p.created_at,p.id LIMIT 1), incoming(name,city,sector) AS (VALUES ('[Demonstração] Fábrica Horizonte','Porto','Indústria'),
('[Demonstração] Transportes Vale','Aveiro','Logística'),
('[Demonstração] Edifício Jardim','Lisboa','Serviços'))
INSERT INTO public.companies(name,city,sector,notes,is_example,organization_id,created_by)
SELECT x.name,x.city,x.sector,'Empresa fictícia para explorar a plataforma. Não corresponde a uma entidade real.',true,t.organization_id,t.id
FROM incoming x CROSS JOIN target t WHERE NOT EXISTS(SELECT 1 FROM public.companies c WHERE c.organization_id=t.organization_id AND c.name=x.name);
WITH target AS (SELECT p.id,p.organization_id FROM public.profiles p JOIN public.organizations o ON o.id=p.organization_id WHERE o.slug='tercis-legacy' AND p.active IS TRUE AND p.role IN ('admin','company_admin') ORDER BY p.created_at,p.id LIMIT 1), incoming(company_name,ref,name) AS (VALUES ('[Demonstração] Fábrica Horizonte','DEMO-TERCIS-001','[Demonstração] Quadro elétrico industrial'),
('[Demonstração] Transportes Vale','DEMO-TERCIS-002','[Demonstração] Automação de transportador'),
('[Demonstração] Edifício Jardim','DEMO-TERCIS-003','[Demonstração] Distribuição e comando'))
INSERT INTO public.budgets(ref,name,company_id,assigned_to,status,sector,notes,include_tax,tax_rate,organization_id,created_by,is_example)
SELECT x.ref,x.name,c.id,t.id,'rascunho','Eletricidade Industrial','DEMONSTRAÇÃO — empresa fictícia e valores ilustrativos. Não representa uma proposta comercial. Não enviar a clientes.',true,23,t.organization_id,t.id,true
FROM incoming x CROSS JOIN target t JOIN public.companies c ON c.organization_id=t.organization_id AND c.name=x.company_name AND c.is_example
WHERE NOT EXISTS(SELECT 1 FROM public.budgets b WHERE b.organization_id=t.organization_id AND b.ref=x.ref);
WITH target AS (SELECT p.id,p.organization_id FROM public.profiles p JOIN public.organizations o ON o.id=p.organization_id WHERE o.slug='tercis-legacy' AND p.active IS TRUE AND p.role IN ('admin','company_admin') ORDER BY p.created_at,p.id LIMIT 1), incoming(ref,code,quantity,cost,position) AS (VALUES ('DEMO-TERCIS-001','ABB-S201-C16',6,8.5,0),
('DEMO-TERCIS-001','HAGER-CDA240D',1,62,1),
('DEMO-TERCIS-001','HAGER-ESC225',2,35,2),
('DEMO-TERCIS-002','NORD-275234356',1,350,0),
('DEMO-TERCIS-002','SIE-6ES7214-1AG40-0XB0',1,420,1),
('DEMO-TERCIS-002','SIE-6EP1332-1SH71',1,65,2),
('DEMO-TERCIS-003','HAGER-MBN116',10,7,0),
('DEMO-TERCIS-003','ABB-S203-C32',2,18,1),
('DEMO-TERCIS-003','SCH-LC1D09BD',1,19,2))
INSERT INTO public.budget_items(budget_id,code,description,reference,brand,category,sector,unit,quantity,unit_cost,margin,discount,notes,sort_order)
SELECT b.id,c.code,c.description,c.reference,c.brand,c.category,c.sector,c.unit,x.quantity,x.cost,25,0,'Valor exclusivamente ilustrativo para demonstração. Não é um preço de compra validado.',x.position
FROM incoming x CROSS JOIN target t JOIN public.budgets b ON b.ref=x.ref AND b.organization_id=t.organization_id AND b.is_example
JOIN public.custom_catalog_items c ON c.code=x.code AND c.organization_id=t.organization_id AND c.active
WHERE NOT EXISTS(SELECT 1 FROM public.budget_items i WHERE i.budget_id=b.id AND i.code=x.code);
INSERT INTO public.company_settings(company_id) SELECT id FROM public.companies WHERE is_example AND organization_id=(SELECT organization_id FROM (SELECT p.id,p.organization_id FROM public.profiles p JOIN public.organizations o ON o.id=p.organization_id WHERE o.slug='tercis-legacy' AND p.active IS TRUE AND p.role IN ('admin','company_admin') ORDER BY p.created_at,p.id LIMIT 1) t)
ON CONFLICT(company_id) DO NOTHING;
SELECT jsonb_build_object('example_companies',(SELECT count(*) FROM public.companies WHERE is_example),'example_budgets',(SELECT count(*) FROM public.budgets WHERE is_example),'example_items',(SELECT count(*) FROM public.budget_items i JOIN public.budgets b ON b.id=i.budget_id WHERE b.is_example)) AS seeded;
COMMIT;
