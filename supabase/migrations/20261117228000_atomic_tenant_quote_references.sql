-- Allocate sequential refs within each organization/year on INSERT only.
-- The client still generates temporary ORC-YYYY-####-XXXXXX references while
-- editing. The saved proposal receives its authoritative transactional ref.
CREATE TABLE IF NOT EXISTS public.tercis_quote_reference_counters (
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  quote_year integer NOT NULL CHECK (quote_year BETWEEN 2000 AND 2200),
  last_number bigint NOT NULL CHECK (last_number>=0),
  PRIMARY KEY(organization_id,quote_year)
);
ALTER TABLE public.tercis_quote_reference_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tercis_quote_reference_counters
  FROM PUBLIC,anon,authenticated;

-- Initialize the next number from existing references to avoid collisions
-- when deploying to a tenant that already has generated local references.
INSERT INTO public.tercis_quote_reference_counters(
  organization_id,quote_year,last_number
)
SELECT b.organization_id,
  substring(b.ref FROM '^ORC-([0-9]{4})-')::integer AS quote_year,
  max(substring(b.ref FROM '^ORC-[0-9]{4}-([0-9]+)')::bigint) AS last_number
FROM public.budgets b
WHERE b.organization_id IS NOT NULL
  AND b.ref ~ '^ORC-[0-9]{4}-[0-9]+(-[0-9A-Fa-f]{6})?
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_year integer;v_counter bigint;v_org uuid;
BEGIN
  -- Legacy/service migrations and manually imported references are untouched.
  -- Only generated temporary browser draft references are replaced.
  IF TG_OP<>'INSERT' OR auth.uid() IS NULL OR
     NEW.ref !~ '^ORC-[0-9]{4}-[0-9]{4,}-[0-9A-Fa-f]{6}$' THEN
    RETURN NEW;
  END IF;
  v_org:=NEW.organization_id;
  IF v_org IS NULL OR v_org IS DISTINCT FROM public.tercis_current_organization_id() THEN
    RAISE EXCEPTION 'Referência comercial: organização não verificada.'
      USING ERRCODE='42501';
  END IF;
  v_year:=extract(year FROM coalesce(NEW.date,current_date))::integer;
  INSERT INTO public.tercis_quote_reference_counters(
    organization_id,quote_year,last_number
  ) VALUES(v_org,v_year,1)
  ON CONFLICT (organization_id,quote_year)
  DO UPDATE SET last_number=public.tercis_quote_reference_counters.last_number+1
  RETURNING last_number INTO v_counter;
  NEW.ref:='ORC-'||v_year::text||'-'||lpad(v_counter::text,6,'0');
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_allocate_quote_reference()
  FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS zz_tercis_allocate_quote_reference ON public.budgets;
CREATE TRIGGER zz_tercis_allocate_quote_reference
  BEFORE INSERT ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.tercis_allocate_quote_reference();

-- The original save RPC is unchanged. Return the exact server-generated
-- reference in the same transaction as the saved optimistic-lock version.
CREATE OR REPLACE FUNCTION public.save_budget_atomic_with_ref(
  p_budget jsonb,p_items jsonb
) RETURNS TABLE(id uuid,version integer,ref text)
LANGUAGE plpgsql SECURITY INVOKER
SET search_path=public,pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  v_id:=public.save_budget_atomic(p_budget,p_items);
  RETURN QUERY SELECT b.id,b.version,b.ref
    FROM public.budgets b WHERE b.id=v_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não foi possível confirmar a referência gravada.'
      USING ERRCODE='42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.save_budget_atomic_with_ref(jsonb,jsonb)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_budget_atomic_with_ref(jsonb,jsonb)
  TO authenticated;

GROUP BY b.organization_id,substring(b.ref FROM '^ORC-([0-9]{4})-')::integer
ON CONFLICT(organization_id,quote_year) DO UPDATE
  SET last_number=greatest(public.tercis_quote_reference_counters.last_number,
    excluded.last_number);

CREATE OR REPLACE FUNCTION public.tercis_allocate_quote_reference()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_year integer;v_counter bigint;v_org uuid;
BEGIN
  -- Legacy/service migrations and manually imported references are untouched.
  -- Only generated temporary browser draft references are replaced.
  IF TG_OP<>'INSERT' OR auth.uid() IS NULL OR
     NEW.ref !~ '^ORC-[0-9]{4}-[0-9]{4,}-[0-9A-Fa-f]{6}$' THEN
    RETURN NEW;
  END IF;
  v_org:=NEW.organization_id;
  IF v_org IS NULL OR v_org IS DISTINCT FROM public.tercis_current_organization_id() THEN
    RAISE EXCEPTION 'Referência comercial: organização não verificada.'
      USING ERRCODE='42501';
  END IF;
  v_year:=extract(year FROM coalesce(NEW.date,current_date))::integer;
  INSERT INTO public.tercis_quote_reference_counters(
    organization_id,quote_year,last_number
  ) VALUES(v_org,v_year,1)
  ON CONFLICT (organization_id,quote_year)
  DO UPDATE SET last_number=public.tercis_quote_reference_counters.last_number+1
  RETURNING last_number INTO v_counter;
  NEW.ref:='ORC-'||v_year::text||'-'||lpad(v_counter::text,6,'0');
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_allocate_quote_reference()
  FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS zz_tercis_allocate_quote_reference ON public.budgets;
CREATE TRIGGER zz_tercis_allocate_quote_reference
  BEFORE INSERT ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.tercis_allocate_quote_reference();

-- The original save RPC is unchanged. Return the exact server-generated
-- reference in the same transaction as the saved optimistic-lock version.
CREATE OR REPLACE FUNCTION public.save_budget_atomic_with_ref(
  p_budget jsonb,p_items jsonb
) RETURNS TABLE(id uuid,version integer,ref text)
LANGUAGE plpgsql SECURITY INVOKER
SET search_path=public,pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  v_id:=public.save_budget_atomic(p_budget,p_items);
  RETURN QUERY SELECT b.id,b.version,b.ref
    FROM public.budgets b WHERE b.id=v_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não foi possível confirmar a referência gravada.'
      USING ERRCODE='42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.save_budget_atomic_with_ref(jsonb,jsonb)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_budget_atomic_with_ref(jsonb,jsonb)
  TO authenticated;
