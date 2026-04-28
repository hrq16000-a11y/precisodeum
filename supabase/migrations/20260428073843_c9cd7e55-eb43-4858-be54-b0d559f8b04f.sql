-- Helper de normalização sem acento (translate é built-in)
CREATE OR REPLACE FUNCTION public._strip_accents(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(translate(coalesce(t,''),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'));
$$;

CREATE OR REPLACE FUNCTION public.fill_provider_coords_from_city()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lat double precision;
  v_lng double precision;
  v_city_norm text;
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.city IS NULL OR length(trim(NEW.city)) = 0 THEN
    RETURN NEW;
  END IF;

  v_city_norm := public._strip_accents(NEW.city);

  -- Match exato por nome+UF
  SELECT c.latitude, c.longitude
    INTO v_lat, v_lng
    FROM public.cities c
   WHERE public._strip_accents(c.name) = v_city_norm
     AND (NEW.state IS NULL OR c.state = NEW.state OR c.state_uf = NEW.state)
     AND c.latitude IS NOT NULL
     AND c.longitude IS NOT NULL
   ORDER BY (c.state = NEW.state) DESC NULLS LAST
   LIMIT 1;

  -- Fallback: match parcial (ex: "Região Metropolitana de Curitiba" → Curitiba)
  IF v_lat IS NULL THEN
    SELECT c.latitude, c.longitude
      INTO v_lat, v_lng
      FROM public.cities c
     WHERE (
            v_city_norm ILIKE '%' || public._strip_accents(c.name) || '%'
         OR public._strip_accents(c.name) ILIKE '%' || v_city_norm || '%'
       )
       AND (NEW.state IS NULL OR c.state = NEW.state OR c.state_uf = NEW.state)
       AND c.latitude IS NOT NULL
       AND c.longitude IS NOT NULL
     ORDER BY length(c.name) ASC
     LIMIT 1;
  END IF;

  IF v_lat IS NOT NULL AND v_lng IS NOT NULL THEN
    NEW.latitude := v_lat;
    NEW.longitude := v_lng;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fill_provider_coords_from_city failed for provider %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_provider_coords_from_city ON public.providers;
CREATE TRIGGER trg_fill_provider_coords_from_city
  BEFORE INSERT OR UPDATE OF city, state, latitude, longitude
  ON public.providers
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_provider_coords_from_city();

-- Backfill: corrige providers existentes com cidade mas sem GPS
UPDATE public.providers p
   SET latitude = c.latitude,
       longitude = c.longitude
  FROM public.cities c
 WHERE p.deleted_at IS NULL
   AND (p.latitude IS NULL OR p.longitude IS NULL)
   AND p.city IS NOT NULL
   AND length(trim(p.city)) > 0
   AND c.latitude IS NOT NULL
   AND c.longitude IS NOT NULL
   AND (
        public._strip_accents(c.name) = public._strip_accents(p.city)
     OR public._strip_accents(p.city) ILIKE '%' || public._strip_accents(c.name) || '%'
   )
   AND (p.state IS NULL OR c.state = p.state OR c.state_uf = p.state);
