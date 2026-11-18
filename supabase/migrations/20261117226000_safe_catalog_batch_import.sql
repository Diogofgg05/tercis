-- Bounded, atomic import of catalogue rows from a validated CSV preview.
-- Server derives tenant and actor identity; never trusts supplied owner IDs.
CREATE OR REPLACE FUNCTION public.tercis_import_catalog_batch(
  p_items jsonb
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_org uuid;v_actor uuid:=auth.uid();v_item jsonb;
DECLARE v_code text;v_desc text;v_cost numeric;v_existing uuid;
DECLARE v_count integer:=0;v_seen text[]:=ARRAY[]::text[];
BEGIN
  IF NOT public.tercis_verified_aal2() THEN
    RAISE EXCEPTION 'Importação de preços exige MFA verificado (AAL2).'
      USING ERRCODE='42501';
  END IF;
  SELECT p.organization_id INTO v_org FROM public.profiles p
  WHERE p.id=v_actor AND p.active IS TRUE AND p.role IN ('admin','company_admin');
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Apenas administradores da organização podem importar custos.'
      USING ERRCODE='42501';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items)<>'array' OR
    jsonb_array_length(p_items)<1 OR jsonb_array_length(p_items)>100 THEN
    RAISE EXCEPTION 'Importe entre 1 e 100 artigos por lote.'
      USING ERRCODE='22023';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF jsonb_typeof(v_item)<>'object' THEN
      RAISE EXCEPTION 'Linha do catálogo inválida.' USING ERRCODE='22023';
    END IF;
    v_code:=btrim(coalesce(v_item->>'code',''));
    v_desc:=btrim(coalesce(v_item->>'description',''));
    IF v_code='' OR length(v_code)>64 OR v_desc='' OR length(v_desc)>500
      OR length(coalesce(v_item->>'supplier',''))>200
      OR length(coalesce(v_item->>'unit',''))>16 THEN
      RAISE EXCEPTION 'Código, descrição ou fornecedor inválidos.'
        USING ERRCODE='22023';
    END IF;
    IF lower(v_code)=ANY(v_seen) THEN
      RAISE EXCEPTION 'Códigos duplicados no lote.' USING ERRCODE='22023';
    END IF;
    v_seen:=array_append(v_seen,lower(v_code));
    BEGIN
      v_cost:=(v_item->>'unit_cost')::numeric;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Custo inválido no ficheiro CSV.' USING ERRCODE='22023';
    END;
    IF v_cost IS NULL OR v_cost<0 OR v_cost>9999999999 OR
       v_cost='NaN'::numeric OR
       round(v_cost,4) IS DISTINCT FROM v_cost THEN
      RAISE EXCEPTION 'Custo fora dos limites ou com mais de quatro casas decimais.'
        USING ERRCODE='22023';
    END IF;

    SELECT id INTO v_existing FROM public.custom_catalog_items
    WHERE organization_id=v_org AND active IS TRUE
      AND lower(btrim(code))=lower(v_code)
    FOR UPDATE;
    IF v_existing IS NULL THEN
      INSERT INTO public.custom_catalog_items(
        organization_id,created_by,code,description,unit_cost,
        reference,brand,category,sector,unit,supplier,active
      ) VALUES (
        v_org,v_actor,v_code,v_desc,v_cost,
        left(coalesce(v_item->>'reference',''),120),
        left(coalesce(v_item->>'brand',''),120),
        left(coalesce(v_item->>'category',''),120),
        left(coalesce(v_item->>'sector',''),120),
        left(coalesce(nullif(v_item->>'unit',''),'un'),16),
        left(coalesce(v_item->>'supplier',''),200),true
      );
    ELSE
      UPDATE public.custom_catalog_items SET
        description=v_desc,unit_cost=v_cost,
        reference=left(coalesce(v_item->>'reference',''),120),
        brand=left(coalesce(v_item->>'brand',''),120),
        category=left(coalesce(v_item->>'category',''),120),
        sector=left(coalesce(v_item->>'sector',''),120),
        unit=left(coalesce(nullif(v_item->>'unit',''),'un'),16),
        supplier=left(coalesce(v_item->>'supplier',''),200)
      WHERE id=v_existing AND organization_id=v_org;
    END IF;
    v_count:=v_count+1;
  END LOOP;
  INSERT INTO public.audit_logs(
    organization_id,actor_id,entity_type,action,metadata
  ) VALUES(v_org,v_actor,'catalog','catalog_batch_imported',
    jsonb_build_object('count',v_count));
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_import_catalog_batch(jsonb)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_import_catalog_batch(jsonb)
  TO authenticated;
