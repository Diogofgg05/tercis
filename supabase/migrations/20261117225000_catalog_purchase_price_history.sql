-- Immutable, tenant-owned purchase-price history (not exposed through
-- PostgREST). Author and organization are derived from the stored row.
CREATE TABLE IF NOT EXISTS public.catalog_purchase_price_history(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  item_id uuid REFERENCES public.custom_catalog_items(id) ON DELETE SET NULL,
  item_code text NOT NULL,
  old_cost numeric(14,4) NOT NULL,
  new_cost numeric(14,4) NOT NULL,
  old_supplier text,
  new_supplier text,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tercis_price_history_item_changed
  ON public.catalog_purchase_price_history(item_id,changed_at DESC);
ALTER TABLE public.catalog_purchase_price_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.catalog_purchase_price_history FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.tercis_audit_catalog_purchase_price()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.unit_cost IS DISTINCT FROM OLD.unit_cost
    OR NEW.supplier IS DISTINCT FROM OLD.supplier THEN
    INSERT INTO public.catalog_purchase_price_history(
      organization_id,item_id,item_code,old_cost,new_cost,
      old_supplier,new_supplier,changed_by
    ) VALUES (
      OLD.organization_id,OLD.id,OLD.code,OLD.unit_cost,NEW.unit_cost,
      OLD.supplier,NEW.supplier,auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tercis_audit_catalog_purchase_price
  ON public.custom_catalog_items;
CREATE TRIGGER tercis_audit_catalog_purchase_price
  AFTER UPDATE OF unit_cost,supplier ON public.custom_catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.tercis_audit_catalog_purchase_price();
REVOKE ALL ON FUNCTION public.tercis_audit_catalog_purchase_price()
  FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.tercis_catalog_price_history(
  p_item_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_org uuid; v_result jsonb;
BEGIN
  SELECT p.organization_id INTO v_org
  FROM public.profiles p
  WHERE p.id=auth.uid() AND p.active IS TRUE AND
    p.role IN ('admin','company_admin');
  IF v_org IS NULL OR p_item_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.custom_catalog_items i
    WHERE i.id=p_item_id AND i.organization_id=v_org
  ) THEN
    RAISE EXCEPTION 'Sem autorização para consultar custos deste artigo.'
      USING ERRCODE='42501';
  END IF;
  SELECT coalesce(jsonb_agg(entry ORDER BY changed_at DESC),'[]'::jsonb)
    INTO v_result
  FROM (
    SELECT h.changed_at,
      jsonb_build_object('old_cost',h.old_cost,'new_cost',h.new_cost,
        'old_supplier',h.old_supplier,'new_supplier',h.new_supplier,
        'changed_at',h.changed_at) AS entry
    FROM public.catalog_purchase_price_history h
    WHERE h.item_id=p_item_id AND h.organization_id=v_org
    ORDER BY h.changed_at DESC LIMIT 50
  ) records;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_catalog_price_history(uuid)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tercis_catalog_price_history(uuid)
  TO authenticated;
