/*
  Catalog integrity per tenant:
  - only one active custom item per normalized code and organization
  - authenticated actors cannot impersonate other item authors
  - malformed catalog prices and blank codes are rejected
  Existing duplicate active codes must be resolved in staging before applying
  the unique index. Archived/inactive rows are intentionally allowed to reuse
  a code and will be rejected if reactivated into a conflict.
*/
CREATE OR REPLACE FUNCTION public.tercis_validate_catalog_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  NEW.code := btrim(NEW.code);
  NEW.description := btrim(NEW.description);
  IF NEW.code IS NULL OR NEW.code='' OR
     NEW.description IS NULL OR NEW.description='' THEN
    RAISE EXCEPTION 'O catálogo exige código e descrição não vazios.'
      USING ERRCODE='22023';
  END IF;
  IF NEW.unit_cost IS NULL OR NEW.unit_cost < 0
     OR NEW.unit_cost='NaN'::numeric THEN
    RAISE EXCEPTION 'O custo do artigo deve ser um número não negativo.'
      USING ERRCODE='22023';
  END IF;
  IF v_actor IS NOT NULL THEN
    IF TG_OP='INSERT' AND NEW.created_by IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'O autor do artigo deve ser o utilizador autenticado.'
        USING ERRCODE='42501';
    END IF;
    IF TG_OP='UPDATE' AND NEW.created_by IS DISTINCT FROM OLD.created_by THEN
      RAISE EXCEPTION 'A autoria de um artigo não pode ser alterada.'
        USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tercis_validate_catalog_item_write ON public.custom_catalog_items;
CREATE TRIGGER tercis_validate_catalog_item_write
  BEFORE INSERT OR UPDATE ON public.custom_catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.tercis_validate_catalog_item();
REVOKE ALL ON FUNCTION public.tercis_validate_catalog_item()
  FROM PUBLIC,anon,authenticated;

-- Stop on duplicates rather than silently deleting or merging business data.
DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM public.custom_catalog_items
    WHERE active IS TRUE
    GROUP BY organization_id,lower(btrim(code))
    HAVING count(*)>1
  ) THEN
    RAISE EXCEPTION 'Existem códigos ativos duplicados no catálogo. Corrija-os em staging antes de aplicar o índice.'
      USING ERRCODE='23505';
  END IF;
END;
$$;
CREATE UNIQUE INDEX IF NOT EXISTS tercis_catalog_active_org_code_unique
  ON public.custom_catalog_items(organization_id,lower(btrim(code)))
  WHERE active IS TRUE;
