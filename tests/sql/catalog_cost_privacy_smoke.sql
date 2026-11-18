-- Raw supplier costs must be inaccessible to customers and platform admins.
INSERT INTO public.custom_catalog_items(code,description,unit_cost,active,created_by)
VALUES('COST-PRIVATE-TEST','Private supplier unit cost',85.40,true,
       '00000000-0000-4000-8000-000000000001');

INSERT INTO auth.users(id,email,raw_user_meta_data)
VALUES('00000000-0000-4000-8000-000000000006','platform@example.test','{}');
UPDATE public.profiles SET role='app_admin',active=true
WHERE id='00000000-0000-4000-8000-000000000006';

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000004';
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.custom_catalog_items
  WHERE code='COST-PRIVATE-TEST';
  IF n<>0 THEN RAISE EXCEPTION 'CUSTOMER EXPOSED TO SUPPLIER COSTS'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000006';
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.custom_catalog_items
  WHERE code='COST-PRIVATE-TEST';
  IF n<>0 THEN RAISE EXCEPTION 'PLATFORM ACCOUNT EXPOSED TO SHARED COMMERCIAL COSTS'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000005';
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.custom_catalog_items
  WHERE code='COST-PRIVATE-TEST';
  IF n<>1 THEN RAISE EXCEPTION 'COMPANY ADMIN CANNOT SEE CATALOG IN OWN ORGANIZATION'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000003';
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.custom_catalog_items
  WHERE code='COST-PRIVATE-TEST';
  IF n<>1 THEN RAISE EXCEPTION 'INTERNAL COLLABORATOR CANNOT READ SHARED CATALOG'; END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.custom_catalog_items
  WHERE code='COST-PRIVATE-TEST';
  IF n<>1 THEN RAISE EXCEPTION 'APPROVED ADMIN LOST CATALOG ACCESS'; END IF;
END $$;
ROLLBACK;

SELECT 'Wholesale catalog cost RLS tests PASSED' AS result;
