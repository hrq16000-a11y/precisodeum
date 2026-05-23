
-- FASE 2.6 — Conversion Optimization Foundation
-- Aggregates conversion signals per provider from canonical funnel (audit_log)
-- + legacy contact_clicks + leads. Pure read-only RPCs. No new tables.

CREATE INDEX IF NOT EXISTS idx_audit_log_funnel_resource
  ON public.audit_log (resource_id, action, created_at DESC)
  WHERE resource_type = 'public_funnel';

CREATE INDEX IF NOT EXISTS idx_leads_provider_created
  ON public.leads (provider_id, created_at DESC);

-- RPC: stats por provider (vetor de uuids), janela _days
CREATE OR REPLACE FUNCTION public.get_provider_conversion_stats(
  _provider_ids uuid[],
  _days int DEFAULT 30
)
RETURNS TABLE (
  provider_id uuid,
  profile_views bigint,
  whatsapp_clicks bigint,
  phone_clicks bigint,
  lead_submits bigint,
  ctr_view_to_contact numeric,
  lead_rate numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ids AS (
    SELECT unnest(coalesce(_provider_ids, ARRAY[]::uuid[])) AS pid
  ),
  views AS (
    SELECT al.resource_id::uuid AS pid, count(*)::bigint AS n
    FROM public.audit_log al
    WHERE al.resource_type = 'public_funnel'
      AND al.action = 'profile_view'
      AND al.created_at >= now() - make_interval(days => greatest(1, least(_days, 365)))
      AND al.resource_id ~* '^[0-9a-f-]{36}$'
      AND al.resource_id::uuid IN (SELECT pid FROM ids)
    GROUP BY al.resource_id
  ),
  leads_agg AS (
    SELECT al.resource_id::uuid AS pid, count(*)::bigint AS n
    FROM public.audit_log al
    WHERE al.resource_type = 'public_funnel'
      AND al.action = 'lead_submit'
      AND al.created_at >= now() - make_interval(days => greatest(1, least(_days, 365)))
      AND al.resource_id ~* '^[0-9a-f-]{36}$'
      AND al.resource_id::uuid IN (SELECT pid FROM ids)
    GROUP BY al.resource_id
  ),
  cc AS (
    SELECT provider_id AS pid,
           count(*) FILTER (WHERE contact_type = 'whatsapp')::bigint AS w,
           count(*) FILTER (WHERE contact_type = 'phone')::bigint AS p
    FROM public.contact_clicks
    WHERE created_at >= now() - make_interval(days => greatest(1, least(_days, 365)))
      AND provider_id IN (SELECT pid FROM ids)
    GROUP BY provider_id
  )
  SELECT
    i.pid,
    coalesce(v.n, 0)         AS profile_views,
    coalesce(cc.w, 0)        AS whatsapp_clicks,
    coalesce(cc.p, 0)        AS phone_clicks,
    coalesce(la.n, 0)        AS lead_submits,
    CASE WHEN coalesce(v.n, 0) > 0
         THEN round( (coalesce(cc.w, 0) + coalesce(cc.p, 0))::numeric / v.n::numeric, 4)
         ELSE 0 END           AS ctr_view_to_contact,
    CASE WHEN coalesce(v.n, 0) > 0
         THEN round( coalesce(la.n, 0)::numeric / v.n::numeric, 4)
         ELSE 0 END           AS lead_rate
  FROM ids i
  LEFT JOIN views v       ON v.pid = i.pid
  LEFT JOIN leads_agg la  ON la.pid = i.pid
  LEFT JOIN cc            ON cc.pid = i.pid;
$$;

GRANT EXECUTE ON FUNCTION public.get_provider_conversion_stats(uuid[], int) TO anon, authenticated;

-- RPC admin: top/bottom + incompletos (somente admin)
CREATE OR REPLACE FUNCTION public.admin_provider_conversion_insights(
  _days int DEFAULT 30,
  _limit int DEFAULT 50
)
RETURNS TABLE (
  provider_id uuid,
  business_name text,
  city text,
  category_slug text,
  profile_views bigint,
  contacts bigint,
  lead_submits bigint,
  ctr numeric,
  lead_rate numeric,
  bucket text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT id FROM public.providers WHERE status IN ('approved','active') OR status IS NULL
  ),
  stats AS (
    SELECT * FROM public.get_provider_conversion_stats(
      (SELECT array_agg(id) FROM base),
      _days
    )
  )
  SELECT
    p.id,
    coalesce(p.business_name, '')::text,
    coalesce(p.city, '')::text,
    coalesce(p.category_slug, '')::text,
    s.profile_views,
    (s.whatsapp_clicks + s.phone_clicks)::bigint AS contacts,
    s.lead_submits,
    s.ctr_view_to_contact,
    s.lead_rate,
    CASE
      WHEN s.profile_views < 10 THEN 'unknown'
      WHEN s.lead_rate >= 0.05 OR s.ctr_view_to_contact >= 0.20 THEN 'high_conversion'
      WHEN s.lead_rate >= 0.02 OR s.ctr_view_to_contact >= 0.10 THEN 'medium_conversion'
      ELSE 'low_conversion'
    END AS bucket
  FROM stats s
  JOIN public.providers p ON p.id = s.provider_id
  ORDER BY (s.lead_submits * 10 + (s.whatsapp_clicks + s.phone_clicks)) DESC, s.profile_views DESC
  LIMIT greatest(1, least(_limit, 500));
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_provider_conversion_insights(int, int) TO authenticated;
