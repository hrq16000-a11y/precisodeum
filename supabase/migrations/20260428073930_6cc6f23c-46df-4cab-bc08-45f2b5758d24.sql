-- Atualiza a função: quando NEW.state é NULL, prioriza cidade com mais providers
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

  -- Match exato. Se NEW.state vier, restringe; se não, pega mais "popular".
  SELECT c.latitude, c.longitude
    INTO v_lat, v_lng
    FROM public.cities c
   WHERE public._strip_accents(c.name) = v_city_norm
     AND (NEW.state IS NULL OR c.state = NEW.state OR c.state_uf = NEW.state)
     AND c.latitude IS NOT NULL
     AND c.longitude IS NOT NULL
   ORDER BY (c.state = NEW.state) DESC NULLS LAST,
            COALESCE(c.provider_count, 0) DESC
   LIMIT 1;

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
     ORDER BY COALESCE(c.provider_count, 0) DESC, length(c.name) ASC
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

-- Backfill final do prestador sem UF
UPDATE public.providers p
   SET latitude = sub.latitude,
       longitude = sub.longitude
  FROM (
    SELECT DISTINCT ON (public._strip_accents(name))
           public._strip_accents(name) AS norm,
           latitude, longitude
      FROM public.cities
     WHERE latitude IS NOT NULL AND longitude IS NOT NULL
     ORDER BY public._strip_accents(name), COALESCE(provider_count, 0) DESC
  ) sub
 WHERE p.deleted_at IS NULL
   AND (p.latitude IS NULL OR p.longitude IS NULL)
   AND p.city IS NOT NULL
   AND length(trim(p.city)) > 0
   AND public._strip_accents(p.city) = sub.norm;
