CREATE OR REPLACE FUNCTION public.slugify_text(_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE s text;
BEGIN
  IF _text IS NULL OR btrim(_text) = '' THEN RETURN ''; END IF;
  s := lower(_text);
  s := translate(
    s,
    'àáâãäåèéêëìíîïòóôõöùúûüýñçÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝÑÇ',
    'aaaaaaeeeeiiiioooooouuuuyncAAAAAAEEEEIIIIOOOOOUUUUYNC'
  );
  s := regexp_replace(s, '[_\s]+', '-', 'g');
  s := regexp_replace(s, '[^a-z0-9-]', '', 'g');
  s := regexp_replace(s, '-{2,}', '-', 'g');
  s := btrim(s, '-');
  RETURN s;
END;
$$;

CREATE OR REPLACE FUNCTION public.sanitize_provider_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  base_name text;
  base_slug text;
  candidate text;
  collision_count int;
  suffix text;
BEGIN
  IF NEW.slug IS NOT NULL AND NEW.slug != '' THEN
    NEW.slug := public.slugify_text(NEW.slug);
  END IF;

  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_name := COALESCE(NULLIF(btrim(NEW.business_name), ''), NULLIF(btrim(NEW.legal_name), ''));

    IF base_name IS NULL AND NEW.user_id IS NOT NULL THEN
      SELECT NULLIF(btrim(p.full_name), '')
        INTO base_name
        FROM public.profiles p
        WHERE p.id = NEW.user_id
        LIMIT 1;
    END IF;

    IF base_name IS NULL OR base_name = '' THEN
      RETURN NEW;
    END IF;

    base_slug := public.slugify_text(
      base_name || CASE WHEN NEW.city IS NOT NULL AND btrim(NEW.city) <> '' THEN ' ' || NEW.city ELSE '' END
    );

    IF base_slug = '' THEN RETURN NEW; END IF;

    candidate := base_slug;
    SELECT count(*) INTO collision_count
      FROM public.providers
     WHERE slug = candidate
       AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    IF collision_count > 0 THEN
      suffix := substr(replace(COALESCE(NEW.id::text, gen_random_uuid()::text), '-', ''), 1, 6);
      candidate := base_slug || '-' || suffix;
    END IF;

    NEW.slug := candidate;
  END IF;

  RETURN NEW;
END;
$function$;

WITH base AS (
  SELECT
    p.id AS pid,
    public.slugify_text(
      COALESCE(NULLIF(btrim(p.business_name), ''), NULLIF(btrim(p.legal_name), ''), NULLIF(btrim(prof.full_name), ''))
      || CASE WHEN p.city IS NOT NULL AND btrim(p.city) <> '' THEN ' ' || p.city ELSE '' END
    ) AS base_slug
  FROM public.providers p
  LEFT JOIN public.profiles prof ON prof.id = p.user_id
  WHERE (p.slug IS NULL OR p.slug = '')
    AND COALESCE(NULLIF(btrim(p.business_name), ''), NULLIF(btrim(p.legal_name), ''), NULLIF(btrim(prof.full_name), '')) IS NOT NULL
), resolved AS (
  SELECT
    b.pid,
    CASE
      WHEN EXISTS (SELECT 1 FROM public.providers x WHERE x.slug = b.base_slug AND x.id <> b.pid)
      THEN b.base_slug || '-' || substr(replace(b.pid::text, '-', ''), 1, 6)
      ELSE b.base_slug
    END AS new_slug
  FROM base b
  WHERE b.base_slug IS NOT NULL AND b.base_slug <> ''
)
UPDATE public.providers pr
   SET slug = r.new_slug
  FROM resolved r
 WHERE pr.id = r.pid;