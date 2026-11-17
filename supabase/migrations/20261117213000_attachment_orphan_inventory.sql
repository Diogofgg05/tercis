-- Service-only, conservative orphan inventory.
-- Uploading to Storage and inserting budget_attachments are separate network
-- requests and cannot be wrapped in one PostgreSQL transaction. An expired
-- orphan is a private Storage file without an associated commercial record.
-- NEVER delete recently uploaded files, recognized metadata, or other buckets.
CREATE OR REPLACE FUNCTION public.tercis_list_orphan_attachment_paths(
  p_limit integer DEFAULT 25
) RETURNS TABLE(path text,age_seconds bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=public,pg_temp AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Inventário de anexos reservado ao serviço de manutenção.'
      USING ERRCODE='42501';
  END IF;
  RETURN QUERY
  SELECT obj.name,
    floor(extract(epoch FROM now()-obj.created_at))::bigint
  FROM storage.objects obj
  WHERE obj.bucket_id='tercis-private-attachments'
    AND obj.created_at<now()-interval '48 hours'
    AND public.tercis_attachment_path_budget(obj.name) IS NOT NULL
    AND NOT EXISTS(
      SELECT 1 FROM public.budget_attachments a WHERE a.file_path=obj.name
    )
  ORDER BY obj.created_at ASC,obj.name ASC
  LIMIT greatest(1,least(coalesce(p_limit,25),50));
END;
$$;
REVOKE ALL ON FUNCTION public.tercis_list_orphan_attachment_paths(integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tercis_list_orphan_attachment_paths(integer)
  TO service_role;
