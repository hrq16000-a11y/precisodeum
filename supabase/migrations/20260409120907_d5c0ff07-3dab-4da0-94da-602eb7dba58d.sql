
-- ETAPA 1: Corrigir dados (desabilitar apenas triggers de usuário)
ALTER TABLE providers DISABLE TRIGGER USER;

UPDATE providers p
SET user_ref = pr.user_ref
FROM profiles pr
WHERE pr.id = p.user_id AND p.user_ref IS DISTINCT FROM pr.user_ref;

ALTER TABLE providers ENABLE TRIGGER USER;

ALTER TABLE services DISABLE TRIGGER USER;

UPDATE services s
SET user_ref = pr.user_ref
FROM providers p
JOIN profiles pr ON pr.id = p.user_id
WHERE s.provider_id = p.id AND s.user_ref IS NULL;

ALTER TABLE services ENABLE TRIGGER USER;

-- ETAPA 2: Criar função copy_user_ref_from_profile
CREATE OR REPLACE FUNCTION public.copy_user_ref_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    SELECT pr.user_ref INTO NEW.user_ref
    FROM profiles pr
    WHERE pr.id = NEW.user_id;
  END IF;

  IF NEW.user_ref IS NULL THEN
    NEW.user_ref :=
      substr(md5(random()::text), 1, 4) || '-' ||
      substr(md5(random()::text), 1, 4) || '-' ||
      substr(md5(random()::text), 1, 4) || '-' ||
      substr(md5(random()::text), 1, 4);
  END IF;

  RETURN NEW;
END;
$$;

-- ETAPA 3: Substituir trigger de providers
DROP TRIGGER IF EXISTS trg_set_user_ref ON providers;
DROP TRIGGER IF EXISTS set_user_ref_providers ON providers;

CREATE TRIGGER trg_copy_user_ref_providers
  BEFORE INSERT ON providers
  FOR EACH ROW
  EXECUTE FUNCTION copy_user_ref_from_profile();

-- ETAPA 4: Proteção na tabela media
DROP TRIGGER IF EXISTS trg_prevent_user_ref_update_media ON media;

CREATE TRIGGER trg_prevent_user_ref_update_media
  BEFORE UPDATE OF user_ref ON media
  FOR EACH ROW
  EXECUTE FUNCTION prevent_user_ref_update();
