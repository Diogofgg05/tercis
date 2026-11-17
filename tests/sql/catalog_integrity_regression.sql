-- Real PostgreSQL catalog integrity regression across two tenants.
-- Tenant B already owns an active item code PRIVATE-B.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000005';
SET LOCAL request.jwt.claims='{"aal":"aal2"}';
DO $$
DECLARE v_id uuid; v_count integer; denied boolean:=false;
BEGIN
  INSERT INTO public.custom_catalog_items(
    code,description,unit_cost,created_by
  ) VALUES('  PRIVATE-B  ','Valid same code in another tenant',12.50,auth.uid())
  RETURNING id INTO v_id;
  IF NOT EXISTS(
    SELECT 1 FROM public.custom_catalog_items
    WHERE id=v_id AND code='PRIVATE-B'
      AND organization_id='00000000-0000-4000-8000-000000000900'
  ) THEN RAISE EXCEPTION 'TENANT A CANNOT USE CODE ALSO IN TENANT B'; END IF;

  BEGIN
    INSERT INTO public.custom_catalog_items(
      code,description,unit_cost,created_by
    ) VALUES('private-b','Duplicate case insensitive',15,auth.uid());
  EXCEPTION WHEN unique_violation THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'DUPLICATE ACTIVE SKU ACCEPTED IN SAME TENANT'; END IF;

  denied:=false;
  BEGIN
    INSERT INTO public.custom_catalog_items(
      code,description,unit_cost,created_by
    ) VALUES('AUTH-SPOOF','Forged creator',15,
      '00000000-0000-4000-8000-000000000007');
  EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'CATALOG AUTHOR IMPERSONATION ACCEPTED'; END IF;

  denied:=false;
  BEGIN
    UPDATE public.custom_catalog_items
      SET created_by='00000000-0000-4000-8000-000000000007'
      WHERE id=v_id;
  EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'CATALOG CREATOR MUTATED'; END IF;

  denied:=false;
  BEGIN
    INSERT INTO public.custom_catalog_items(
      code,description,unit_cost,created_by
    ) VALUES('  ','Blank code',12,auth.uid());
  EXCEPTION WHEN SQLSTATE '22023' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'BLANK CATALOG CODE ACCEPTED'; END IF;

  denied:=false;
  BEGIN
    INSERT INTO public.custom_catalog_items(
      code,description,unit_cost,created_by
    ) VALUES('NEG-COST','Negative cost',-1,auth.uid());
  EXCEPTION WHEN SQLSTATE '22023' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'NEGATIVE CATALOG COST ACCEPTED'; END IF;

  -- Archived article may retain its code without blocking the active article.
  INSERT INTO public.custom_catalog_items(
    code,description,unit_cost,created_by,active
  ) VALUES('PRIVATE-B','Archived historical item',5,auth.uid(),false);
  SELECT count(*) INTO v_count FROM public.custom_catalog_items
    WHERE lower(code)='private-b';
  IF v_count<>2 THEN RAISE EXCEPTION 'ARCHIVED CATALOG RECORD WAS LOST'; END IF;

  denied:=false;
  BEGIN
    UPDATE public.custom_catalog_items SET active=true
    WHERE lower(description)='archived historical item';
  EXCEPTION WHEN unique_violation THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'REACTIVATED DUPLICATE SKU'; END IF;
END $$;
ROLLBACK;

SELECT 'Catalog unique codes per tenant and author integrity PASSED' AS result;
