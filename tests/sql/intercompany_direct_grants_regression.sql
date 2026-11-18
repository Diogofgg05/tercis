-- Immediately after migration, before test fixtures grant generic table rights.
DO $$
BEGIN
  IF has_table_privilege('authenticated','public.tercis_business_links','SELECT')
    OR has_table_privilege('authenticated','public.tercis_business_links','INSERT')
    OR has_table_privilege('authenticated','public.tercis_business_links','UPDATE')
    OR has_table_privilege('authenticated','public.tercis_business_links','DELETE')
    OR has_table_privilege('anon','public.tercis_business_links','SELECT')
  THEN
    RAISE EXCEPTION 'TENANT BUSINESS LINK TABLE IS DIRECTLY ACCESSIBLE';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.tercis_business_links'::regclass)
    THEN RAISE EXCEPTION 'TENANT BUSINESS LINK TABLE HAS NO ROW LEVEL SECURITY';
  END IF;
END $$;
SELECT 'Pre-fixture company-link database grants PASSED' AS result;
