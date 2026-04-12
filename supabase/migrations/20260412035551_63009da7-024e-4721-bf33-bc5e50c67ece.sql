
-- 1. RPC: nearby_providers
CREATE OR REPLACE FUNCTION public.nearby_providers(
  _lat double precision,
  _lng double precision,
  _radius_m integer DEFAULT 50000,
  _category_slug text DEFAULT NULL,
  _limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  slug text,
  business_name text,
  category_name text,
  category_slug text,
  category_icon text,
  city text,
  state text,
  neighborhood text,
  latitude numeric,
  longitude numeric,
  distance_m double precision,
  rating_avg numeric,
  review_count integer,
  photo_url text,
  plan text,
  featured boolean,
  user_id uuid,
  phone text,
  whatsapp text,
  description text,
  years_experience integer,
  services_count integer,
  portfolio_album_count integer,
  portfolio_photo_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  ref_point geography;
BEGIN
  ref_point := ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography;
  
  RETURN QUERY
  SELECT
    p.id,
    p.slug,
    p.business_name,
    c.name AS category_name,
    c.slug AS category_slug,
    c.icon AS category_icon,
    p.city,
    p.state,
    p.neighborhood,
    p.latitude,
    p.longitude,
    ST_Distance(p.geog, ref_point) AS distance_m,
    p.rating_avg,
    p.review_count,
    p.photo_url,
    p.plan,
    p.featured,
    p.user_id,
    p.phone,
    p.whatsapp,
    p.description,
    p.years_experience,
    p.services_count,
    p.portfolio_album_count,
    p.portfolio_photo_count
  FROM providers p
  LEFT JOIN categories c ON c.id = p.category_id
  WHERE p.status = 'approved'
    AND p.deleted_at IS NULL
    AND p.geog IS NOT NULL
    AND ST_DWithin(p.geog, ref_point, _radius_m)
    AND (_category_slug IS NULL OR c.slug = _category_slug)
  ORDER BY distance_m ASC
  LIMIT _limit;
END;
$$;

-- 2. Add geom column to neighborhoods for future polygon data
ALTER TABLE public.neighborhoods
  ADD COLUMN IF NOT EXISTS geom extensions.geometry(MultiPolygon, 4326);

CREATE INDEX IF NOT EXISTS idx_neighborhoods_geom
  ON public.neighborhoods USING GIST (geom);

-- 3. Helper: get neighborhood name by point
CREATE OR REPLACE FUNCTION public.get_neighborhood_by_point(
  _lat double precision,
  _lng double precision
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT n.name
  FROM neighborhoods n
  WHERE n.geom IS NOT NULL
    AND ST_Contains(n.geom, ST_SetSRID(ST_MakePoint(_lng, _lat), 4326))
  LIMIT 1;
$$;
