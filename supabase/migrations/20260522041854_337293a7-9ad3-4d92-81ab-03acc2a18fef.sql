
-- Helper: resolve capacity for a (position, city, category) tuple from sponsor_slot_limits
CREATE OR REPLACE FUNCTION public.resolve_sponsor_slot_capacity(
  _position text,
  _city text,
  _category text
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    -- city + position specific
    (SELECT max_slots FROM sponsor_slot_limits
       WHERE context_type = 'city' AND context_value = NULLIF(_city, '') LIMIT 1),
    -- category specific
    (SELECT max_slots FROM sponsor_slot_limits
       WHERE context_type = 'category' AND context_value = NULLIF(_category, '') LIMIT 1),
    -- city default
    (SELECT max_slots FROM sponsor_slot_limits
       WHERE context_type = 'city' AND context_value = '_default' LIMIT 1),
    -- category default
    (SELECT max_slots FROM sponsor_slot_limits
       WHERE context_type = 'category' AND context_value = '_default' LIMIT 1),
    -- global
    (SELECT max_slots FROM sponsor_slot_limits
       WHERE context_type = 'global' LIMIT 1),
    3
  );
$$;

-- Inventory status: occupancy per (position, city, category)
CREATE OR REPLACE FUNCTION public.get_sponsor_inventory_status()
RETURNS TABLE(
  slot_slug text,
  city text,
  category text,
  active_sponsors bigint,
  max_capacity integer,
  available_slots integer,
  occupancy_rate numeric,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH grouped AS (
    SELECT
      COALESCE(NULLIF(position, ''), 'unknown') AS slot_slug,
      COALESCE(NULLIF(linked_city, ''), '_any') AS city,
      COALESCE(NULLIF(linked_category, ''), '_any') AS category,
      COUNT(*)::bigint AS active_sponsors
    FROM sponsors
    WHERE deleted_at IS NULL
      AND status = 'active'
      AND (campaign_end IS NULL OR campaign_end >= now())
    GROUP BY 1, 2, 3
  )
  SELECT
    g.slot_slug,
    g.city,
    g.category,
    g.active_sponsors,
    public.resolve_sponsor_slot_capacity(
      g.slot_slug,
      NULLIF(g.city, '_any'),
      NULLIF(g.category, '_any')
    ) AS max_capacity,
    GREATEST(
      public.resolve_sponsor_slot_capacity(g.slot_slug, NULLIF(g.city, '_any'), NULLIF(g.category, '_any'))
      - g.active_sponsors::int,
      0
    ) AS available_slots,
    ROUND(
      LEAST(
        g.active_sponsors::numeric /
        NULLIF(public.resolve_sponsor_slot_capacity(g.slot_slug, NULLIF(g.city, '_any'), NULLIF(g.category, '_any')), 0),
        1
      ) * 100,
      1
    ) AS occupancy_rate,
    CASE
      WHEN g.active_sponsors >=
           public.resolve_sponsor_slot_capacity(g.slot_slug, NULLIF(g.city, '_any'), NULLIF(g.category, '_any'))
        THEN 'saturated'
      WHEN g.active_sponsors::numeric /
           NULLIF(public.resolve_sponsor_slot_capacity(g.slot_slug, NULLIF(g.city, '_any'), NULLIF(g.category, '_any')), 0)
           >= 0.7 THEN 'moderate'
      ELSE 'available'
    END AS status
  FROM grouped g
  WHERE has_role(auth.uid(), 'admin'::app_role)
  ORDER BY g.active_sponsors DESC, g.slot_slug;
$$;

-- Forecast: simple projection for next 30 days
CREATE OR REPLACE FUNCTION public.get_sponsor_inventory_forecast(_days integer DEFAULT 30)
RETURNS TABLE(
  slot_slug text,
  city text,
  category text,
  active_sponsors bigint,
  ending_soon bigint,
  avg_new_per_day numeric,
  projected_active bigint,
  max_capacity integer,
  projected_occupancy_rate numeric,
  forecast text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      COALESCE(NULLIF(position, ''), 'unknown') AS slot_slug,
      COALESCE(NULLIF(linked_city, ''), '_any') AS city,
      COALESCE(NULLIF(linked_category, ''), '_any') AS category,
      COUNT(*) FILTER (WHERE status = 'active' AND (campaign_end IS NULL OR campaign_end >= now())) AS active_sponsors,
      COUNT(*) FILTER (WHERE status = 'active' AND campaign_end IS NOT NULL
                            AND campaign_end BETWEEN now() AND now() + (_days || ' days')::interval) AS ending_soon,
      ROUND(
        COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days')::numeric / 30.0,
        2
      ) AS avg_new_per_day
    FROM sponsors
    WHERE deleted_at IS NULL
    GROUP BY 1, 2, 3
  )
  SELECT
    b.slot_slug,
    b.city,
    b.category,
    b.active_sponsors,
    b.ending_soon,
    b.avg_new_per_day,
    GREATEST(b.active_sponsors - b.ending_soon + (b.avg_new_per_day * _days)::bigint, 0) AS projected_active,
    public.resolve_sponsor_slot_capacity(b.slot_slug, NULLIF(b.city, '_any'), NULLIF(b.category, '_any')) AS max_capacity,
    ROUND(
      LEAST(
        GREATEST(b.active_sponsors - b.ending_soon + (b.avg_new_per_day * _days)::bigint, 0)::numeric /
        NULLIF(public.resolve_sponsor_slot_capacity(b.slot_slug, NULLIF(b.city, '_any'), NULLIF(b.category, '_any')), 0),
        1
      ) * 100,
      1
    ) AS projected_occupancy_rate,
    CASE
      WHEN GREATEST(b.active_sponsors - b.ending_soon + (b.avg_new_per_day * _days)::bigint, 0)::numeric /
           NULLIF(public.resolve_sponsor_slot_capacity(b.slot_slug, NULLIF(b.city, '_any'), NULLIF(b.category, '_any')), 0)
           >= 1 THEN 'will_saturate'
      WHEN GREATEST(b.active_sponsors - b.ending_soon + (b.avg_new_per_day * _days)::bigint, 0)::numeric /
           NULLIF(public.resolve_sponsor_slot_capacity(b.slot_slug, NULLIF(b.city, '_any'), NULLIF(b.category, '_any')), 0)
           >= 0.7 THEN 'tight'
      ELSE 'comfortable'
    END AS forecast
  FROM base b
  WHERE has_role(auth.uid(), 'admin'::app_role)
  ORDER BY b.active_sponsors DESC, b.slot_slug;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_sponsor_slot_capacity(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sponsor_inventory_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sponsor_inventory_forecast(integer) TO authenticated;
