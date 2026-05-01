-- RPC para sugerir cidades próximas a partir de uma cidade-base, ordenadas por distância (Haversine).
-- Buckets: perto (≤15 km), médio (≤50 km), longe (≤100 km).
CREATE OR REPLACE FUNCTION public.suggest_nearby_cities(
  _base_city text,
  _base_state text,
  _max_km double precision DEFAULT 100,
  _limit integer DEFAULT 30
)
RETURNS TABLE (
  id uuid,
  name text,
  state_uf text,
  latitude double precision,
  longitude double precision,
  distance_km double precision,
  bucket text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  base_lat double precision;
  base_lng double precision;
BEGIN
  -- Localiza a cidade-base para obter coordenadas
  SELECT c.latitude, c.longitude INTO base_lat, base_lng
  FROM public.cities c
  WHERE lower(c.name) = lower(_base_city)
    AND (
      _base_state IS NULL OR _base_state = '' OR
      upper(coalesce(c.state_uf, c.state)) = upper(_base_state)
    )
  ORDER BY (CASE WHEN upper(coalesce(c.state_uf, c.state)) = upper(coalesce(_base_state, '')) THEN 0 ELSE 1 END)
  LIMIT 1;

  IF base_lat IS NULL OR base_lng IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    coalesce(c.state_uf, c.state) AS state_uf,
    c.latitude,
    c.longitude,
    (6371 * 2 * asin(sqrt(
      power(sin(radians(c.latitude - base_lat)/2), 2) +
      cos(radians(base_lat)) * cos(radians(c.latitude)) *
      power(sin(radians(c.longitude - base_lng)/2), 2)
    )))::double precision AS distance_km,
    CASE
      WHEN (6371 * 2 * asin(sqrt(
        power(sin(radians(c.latitude - base_lat)/2), 2) +
        cos(radians(base_lat)) * cos(radians(c.latitude)) *
        power(sin(radians(c.longitude - base_lng)/2), 2)
      ))) <= 15 THEN 'near'
      WHEN (6371 * 2 * asin(sqrt(
        power(sin(radians(c.latitude - base_lat)/2), 2) +
        cos(radians(base_lat)) * cos(radians(c.latitude)) *
        power(sin(radians(c.longitude - base_lng)/2), 2)
      ))) <= 50 THEN 'mid'
      ELSE 'far'
    END AS bucket
  FROM public.cities c
  WHERE c.latitude IS NOT NULL
    AND c.longitude IS NOT NULL
    AND NOT (lower(c.name) = lower(_base_city)
             AND upper(coalesce(c.state_uf, c.state)) = upper(coalesce(_base_state, '')))
    AND (6371 * 2 * asin(sqrt(
      power(sin(radians(c.latitude - base_lat)/2), 2) +
      cos(radians(base_lat)) * cos(radians(c.latitude)) *
      power(sin(radians(c.longitude - base_lng)/2), 2)
    ))) <= _max_km
  ORDER BY distance_km ASC
  LIMIT _limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.suggest_nearby_cities(text, text, double precision, integer) TO anon, authenticated;