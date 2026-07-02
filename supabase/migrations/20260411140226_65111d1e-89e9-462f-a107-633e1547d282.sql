
-- Add coordinate columns to cities
ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Backfill from average provider coordinates per city
UPDATE public.cities c
SET
  latitude = sub.avg_lat,
  longitude = sub.avg_lon
FROM (
  SELECT
    LOWER(TRIM(p.city)) AS city_lower,
    UPPER(TRIM(p.state)) AS state_upper,
    AVG(p.latitude) AS avg_lat,
    AVG(p.longitude) AS avg_lon
  FROM public.providers p
  WHERE p.latitude IS NOT NULL
    AND p.longitude IS NOT NULL
    AND p.status = 'approved'
    AND p.deleted_at IS NULL
  GROUP BY LOWER(TRIM(p.city)), UPPER(TRIM(p.state))
) sub
WHERE LOWER(TRIM(c.name)) = sub.city_lower
  AND UPPER(COALESCE(c.state_uf, c.state)) = sub.state_upper;
