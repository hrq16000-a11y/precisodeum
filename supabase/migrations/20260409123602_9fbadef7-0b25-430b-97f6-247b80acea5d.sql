
-- MIGRAÇÃO 1: Corrigir services divergentes + trocar trigger
ALTER TABLE services DISABLE TRIGGER USER;

UPDATE services s
SET user_ref = p.user_ref
FROM providers p
WHERE s.provider_id = p.id AND s.user_ref IS DISTINCT FROM p.user_ref;

ALTER TABLE services ENABLE TRIGGER USER;

DROP TRIGGER IF EXISTS trg_set_user_ref_services ON services;
DROP TRIGGER IF EXISTS trg_set_user_ref ON services;
DROP TRIGGER IF EXISTS set_user_ref_services ON services;

CREATE TRIGGER trg_copy_user_ref_services
  BEFORE INSERT ON services FOR EACH ROW
  EXECUTE FUNCTION copy_user_ref_from_profile();

-- MIGRAÇÃO 2: Corrigir media (UUID → user_ref curto)
ALTER TABLE media DISABLE TRIGGER USER;

UPDATE media m
SET user_ref = pr.user_ref
FROM profiles pr
WHERE pr.id::text = m.user_ref;

ALTER TABLE media ENABLE TRIGGER USER;

-- MIGRAÇÃO 3: Trigger auto-preenchimento media
CREATE OR REPLACE FUNCTION public.set_media_user_ref_from_path()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  parts text[];
BEGIN
  IF NEW.user_ref IS NULL AND NEW.storage_path IS NOT NULL THEN
    parts := string_to_array(NEW.storage_path, '/');
    IF array_length(parts, 1) >= 2 THEN
      SELECT pr.user_ref INTO NEW.user_ref
      FROM profiles pr WHERE pr.id::text = parts[2];
    END IF;
  END IF;

  IF NEW.user_ref IS NULL THEN
    NEW.user_ref := 'unlinked';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_user_ref_media ON media;

CREATE TRIGGER trg_set_user_ref_media
  BEFORE INSERT ON media
  FOR EACH ROW
  EXECUTE FUNCTION set_media_user_ref_from_path();

-- AUDITORIA: Função de validação
CREATE OR REPLACE FUNCTION public.audit_user_ref_full()
RETURNS TABLE(
    table_name text,
    total_records bigint,
    invalid_refs bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 'profiles'::text,
    (SELECT COUNT(*) FROM profiles),
    (SELECT COUNT(*) FROM profiles WHERE user_ref IS NULL);

  RETURN QUERY
  SELECT 'providers'::text,
    (SELECT COUNT(*) FROM providers),
    (SELECT COUNT(*) FROM providers p WHERE p.user_ref IS NULL OR NOT EXISTS (
      SELECT 1 FROM profiles pr WHERE pr.user_ref = p.user_ref
    ));

  RETURN QUERY
  SELECT 'services'::text,
    (SELECT COUNT(*) FROM services),
    (SELECT COUNT(*) FROM services s WHERE s.user_ref IS NULL OR NOT EXISTS (
      SELECT 1 FROM providers p WHERE p.user_ref = s.user_ref
    ));

  RETURN QUERY
  SELECT 'media'::text,
    (SELECT COUNT(*) FROM media),
    (SELECT COUNT(*) FROM media m WHERE m.user_ref IS NULL OR (
      m.user_ref NOT IN ('unlinked', 'sponsors', 'settings') AND
      NOT EXISTS (SELECT 1 FROM profiles pr WHERE pr.user_ref = m.user_ref)
    ));

  RETURN QUERY
  SELECT 'sponsors'::text, 0::bigint, 0::bigint;
END;
$$;
