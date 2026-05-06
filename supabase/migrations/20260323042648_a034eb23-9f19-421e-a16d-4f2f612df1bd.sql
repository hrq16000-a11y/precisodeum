-- Function to sanitize slugs (same logic as frontend)
CREATE OR REPLACE FUNCTION public.sanitize_provider_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.slug IS NOT NULL AND NEW.slug != '' THEN
    -- Lowercase
    NEW.slug := LOWER(NEW.slug);
    -- Remove accents via unaccent-like transliteration
    NEW.slug := TRANSLATE(
      NEW.slug,
      'àáâãäåèéêëìíîïòóôõöùúûüýñçÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝÑÇ',
      'aaaaaaeeeeiiiioooooouuuuyncAAAAAAEEEEIIIIOOOOOUUUUYNC'
    );
    -- Replace spaces/underscores with hyphens
    NEW.slug := REGEXP_REPLACE(NEW.slug, '[_\s]+', '-', 'g');
    -- Remove invalid characters
    NEW.slug := REGEXP_REPLACE(NEW.slug, '[^a-z0-9-]', '', 'g');
    -- Collapse multiple hyphens
    NEW.slug := REGEXP_REPLACE(NEW.slug, '-{2,}', '-', 'g');
    -- Trim leading/trailing hyphens
    NEW.slug := TRIM(BOTH '-' FROM NEW.slug);
  END IF;
  RETURN NEW;
END;
$function$;

-- Attach trigger
CREATE TRIGGER trg_sanitize_provider_slug
  BEFORE INSERT OR UPDATE ON public.providers
  FOR EACH ROW
  EXECUTE FUNCTION public.sanitize_provider_slug();

-- Fix all existing slugs
UPDATE public.providers
SET slug = TRIM(BOTH '-' FROM
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        TRANSLATE(
          LOWER(slug),
          'àáâãäåèéêëìíîïòóôõöùúûüýñçÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝÑÇ%',
          'aaaaaaeeeeiiiioooooouuuuyncAAAAAAEEEEIIIIOOOOOUUUUYNC '
        ),
        '[^a-z0-9-]', '', 'g'
      ),
      '-{2,}', '-', 'g'
    ),
    '[_\s]+', '-', 'g'
  )
)
WHERE slug ~ '[^a-z0-9-]' OR slug ~ '-{2,}' OR slug ~ '^-|-$';