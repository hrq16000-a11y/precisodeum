CREATE TABLE IF NOT EXISTS public.provider_slug_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_slug_aliases_provider_id
  ON public.provider_slug_aliases (provider_id);

ALTER TABLE public.provider_slug_aliases ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'provider_slug_aliases'
      AND policyname = 'Provider slug aliases are viewable by everyone'
  ) THEN
    CREATE POLICY "Provider slug aliases are viewable by everyone"
      ON public.provider_slug_aliases
      FOR SELECT
      USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sanitize_slug_text(value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  sanitized text;
BEGIN
  sanitized := coalesce(lower(value), '');
  sanitized := translate(
    sanitized,
    'àáâãäåèéêëìíîïòóôõöùúûüýñçÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝÑÇ',
    'aaaaaaeeeeiiiioooooouuuuyncAAAAAAEEEEIIIIOOOOOUUUUYNC'
  );
  sanitized := regexp_replace(sanitized, '[_\s]+', '-', 'g');
  sanitized := regexp_replace(sanitized, '[^a-z0-9-]', '', 'g');
  sanitized := regexp_replace(sanitized, '-{2,}', '-', 'g');
  sanitized := trim(both '-' from sanitized);

  RETURN nullif(sanitized, '');
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_provider_slug(
  full_name text,
  business_name text,
  city text
)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  candidate text;
BEGIN
  candidate := public.sanitize_slug_text(
    concat_ws(' ',
      nullif(trim(coalesce(full_name, '')), ''),
      nullif(trim(coalesce(business_name, '')), ''),
      nullif(trim(coalesce(city, '')), '')
    )
  );

  IF candidate IS NULL THEN
    candidate := public.sanitize_slug_text(
      coalesce(nullif(trim(business_name), ''), nullif(trim(full_name), ''), nullif(trim(city), ''), 'profissional')
    );
  END IF;

  RETURN coalesce(candidate, 'profissional');
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_provider_slug(
  desired_slug text,
  current_provider_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  base_slug text := coalesce(nullif(public.sanitize_slug_text(desired_slug), ''), 'profissional');
  final_slug text := base_slug;
  suffix integer := 2;
BEGIN
  LOOP
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.providers p
      WHERE p.slug = final_slug
        AND (current_provider_id IS NULL OR p.id <> current_provider_id)
    );

    final_slug := base_slug || '-' || suffix::text;
    suffix := suffix + 1;
  END LOOP;

  RETURN final_slug;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_provider_canonical_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  provider_full_name text;
  desired_slug text;
BEGIN
  SELECT p.full_name
  INTO provider_full_name
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  desired_slug := public.generate_provider_slug(provider_full_name, NEW.business_name, NEW.city);

  IF TG_OP = 'INSERT'
     OR NEW.slug IS NULL
     OR NEW.slug = ''
     OR NEW.business_name IS DISTINCT FROM OLD.business_name
     OR NEW.city IS DISTINCT FROM OLD.city
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    NEW.slug := public.reserve_provider_slug(desired_slug, NEW.id);
  ELSE
    NEW.slug := public.reserve_provider_slug(NEW.slug, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_provider_canonical_slug ON public.providers;
CREATE TRIGGER trg_apply_provider_canonical_slug
  BEFORE INSERT OR UPDATE ON public.providers
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_provider_canonical_slug();

CREATE OR REPLACE FUNCTION public.sync_provider_slug_aliases()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.slug IS NOT NULL AND OLD.slug <> '' AND OLD.slug IS DISTINCT FROM NEW.slug THEN
    INSERT INTO public.provider_slug_aliases (provider_id, slug)
    VALUES (NEW.id, public.sanitize_slug_text(OLD.slug))
    ON CONFLICT (slug) DO NOTHING;
  END IF;

  IF NEW.slug IS NOT NULL AND NEW.slug <> '' THEN
    INSERT INTO public.provider_slug_aliases (provider_id, slug)
    VALUES (NEW.id, public.sanitize_slug_text(NEW.slug))
    ON CONFLICT (slug) DO UPDATE
      SET provider_id = EXCLUDED.provider_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_provider_slug_aliases ON public.providers;
CREATE TRIGGER trg_sync_provider_slug_aliases
  AFTER INSERT OR UPDATE ON public.providers
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_provider_slug_aliases();

CREATE OR REPLACE FUNCTION public.refresh_provider_slug_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.full_name IS DISTINCT FROM OLD.full_name THEN
    UPDATE public.providers
    SET slug = NULL,
        updated_at = now()
    WHERE user_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_provider_slug_from_profile ON public.profiles;
CREATE TRIGGER trg_refresh_provider_slug_from_profile
  AFTER UPDATE OF full_name ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_provider_slug_from_profile();

INSERT INTO public.provider_slug_aliases (provider_id, slug)
SELECT id, public.sanitize_slug_text(slug)
FROM public.providers
WHERE slug IS NOT NULL
  AND trim(slug) <> ''
ON CONFLICT (slug) DO NOTHING;

UPDATE public.providers
SET slug = NULL
WHERE true;
