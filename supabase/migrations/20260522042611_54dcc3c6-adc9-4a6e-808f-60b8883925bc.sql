
-- ===== Helper: normalize_slug =====
CREATE OR REPLACE FUNCTION public.normalize_slug(_input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT NULLIF(
    regexp_replace(
      regexp_replace(
        lower(extensions.unaccent(coalesce(_input, ''))),
        '[^a-z0-9]+', '-', 'g'
      ),
      '(^-+|-+$)', '', 'g'
    ),
    ''
  );
$$;

-- ===== New columns on sponsors =====
ALTER TABLE public.sponsors
  ADD COLUMN IF NOT EXISTS linked_city_slug text,
  ADD COLUMN IF NOT EXISTS linked_category_slug text;

-- ===== Trigger: keep slugs in sync =====
CREATE OR REPLACE FUNCTION public.sync_sponsor_normalized_slugs()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.linked_city_slug := public.normalize_slug(NEW.linked_city);
  NEW.linked_category_slug := public.normalize_slug(NEW.linked_category);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_sponsor_normalized_slugs ON public.sponsors;
CREATE TRIGGER trg_sync_sponsor_normalized_slugs
BEFORE INSERT OR UPDATE OF linked_city, linked_category
ON public.sponsors
FOR EACH ROW
EXECUTE FUNCTION public.sync_sponsor_normalized_slugs();

-- ===== Backfill (non-destructive) =====
UPDATE public.sponsors
SET
  linked_city_slug = public.normalize_slug(linked_city),
  linked_category_slug = public.normalize_slug(linked_category)
WHERE linked_city_slug IS NULL OR linked_category_slug IS NULL
  OR linked_city_slug IS DISTINCT FROM public.normalize_slug(linked_city)
  OR linked_category_slug IS DISTINCT FROM public.normalize_slug(linked_category);

-- ===== Indexes =====
CREATE INDEX IF NOT EXISTS idx_sponsors_city_slug
  ON public.sponsors(linked_city_slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sponsors_category_slug
  ON public.sponsors(linked_category_slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sponsors_position_slugs
  ON public.sponsors(position, linked_city_slug, linked_category_slug)
  WHERE deleted_at IS NULL AND status = 'active';

-- ===== Updated capacity resolver: accepts slugs =====
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
    (SELECT max_slots FROM sponsor_slot_limits
       WHERE context_type = 'city' AND context_value = NULLIF(_city, '') LIMIT 1),
    (SELECT max_slots FROM sponsor_slot_limits
       WHERE context_type = 'category' AND context_value = NULLIF(_category, '') LIMIT 1),
    (SELECT max_slots FROM sponsor_slot_limits
       WHERE context_type = 'city' AND context_value = '_default' LIMIT 1),
    (SELECT max_slots FROM sponsor_slot_limits
       WHERE context_type = 'category' AND context_value = '_default' LIMIT 1),
    (SELECT max_slots FROM sponsor_slot_limits
       WHERE context_type = 'global' LIMIT 1),
    3
  );
$$;

-- ===== Inventory status grouped by normalized slugs =====
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
      COALESCE(linked_city_slug, public.normalize_slug(linked_city), '_any') AS city,
      COALESCE(linked_category_slug, public.normalize_slug(linked_category), '_any') AS category,
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
      g.slot_slug, NULLIF(g.city, '_any'), NULLIF(g.category, '_any')
    ) AS max_capacity,
    GREATEST(
      public.resolve_sponsor_slot_capacity(g.slot_slug, NULLIF(g.city, '_any'), NULLIF(g.category, '_any'))
      - g.active_sponsors::int, 0
    ) AS available_slots,
    ROUND(
      LEAST(
        g.active_sponsors::numeric /
        NULLIF(public.resolve_sponsor_slot_capacity(g.slot_slug, NULLIF(g.city, '_any'), NULLIF(g.category, '_any')), 0),
        1
      ) * 100, 1
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

-- ===== Forecast grouped by normalized slugs =====
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
      COALESCE(linked_city_slug, public.normalize_slug(linked_city), '_any') AS city,
      COALESCE(linked_category_slug, public.normalize_slug(linked_category), '_any') AS category,
      COUNT(*) FILTER (WHERE status = 'active' AND (campaign_end IS NULL OR campaign_end >= now())) AS active_sponsors,
      COUNT(*) FILTER (WHERE status = 'active' AND campaign_end IS NOT NULL
                            AND campaign_end BETWEEN now() AND now() + (_days || ' days')::interval) AS ending_soon,
      ROUND(
        COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days')::numeric / 30.0, 2
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
      ) * 100, 1
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

-- ===== Commercial search RPC =====
CREATE OR REPLACE FUNCTION public.search_sponsor_inventory(
  _city text DEFAULT NULL,
  _category text DEFAULT NULL,
  _slot text DEFAULT NULL
)
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
  SELECT *
  FROM public.get_sponsor_inventory_status() s
  WHERE
    (_slot IS NULL OR s.slot_slug = lower(trim(_slot)))
    AND (_city IS NULL OR s.city = COALESCE(public.normalize_slug(_city), '_any'))
    AND (_category IS NULL OR s.category = COALESCE(public.normalize_slug(_category), '_any'));
$$;

GRANT EXECUTE ON FUNCTION public.normalize_slug(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.search_sponsor_inventory(text, text, text) TO authenticated;
