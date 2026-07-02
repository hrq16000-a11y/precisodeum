CREATE TABLE IF NOT EXISTS public.exit_intent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('impression','cta_signup','cta_whatsapp','cta_secondary','dismiss','post_signup_conversion')),
  pathname TEXT NOT NULL,
  page_kind TEXT,
  city TEXT,
  state TEXT,
  neighborhood TEXT,
  source TEXT,
  user_id UUID,
  session_id TEXT,
  user_agent TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exit_intent_events_created_at ON public.exit_intent_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exit_intent_events_kind ON public.exit_intent_events (kind);
CREATE INDEX IF NOT EXISTS idx_exit_intent_events_page_kind ON public.exit_intent_events (page_kind);
CREATE INDEX IF NOT EXISTS idx_exit_intent_events_city ON public.exit_intent_events (city);
CREATE INDEX IF NOT EXISTS idx_exit_intent_events_session_id ON public.exit_intent_events (session_id);

ALTER TABLE public.exit_intent_events ENABLE ROW LEVEL SECURITY;

-- Anyone (incl. anonymous) can insert events
CREATE POLICY "exit_intent_events_insert_anyone"
  ON public.exit_intent_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can read
CREATE POLICY "exit_intent_events_select_admin"
  ON public.exit_intent_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Funnel aggregation RPC for /admin
CREATE OR REPLACE FUNCTION public.admin_exit_intent_funnel(
  p_since TIMESTAMPTZ DEFAULT (now() - interval '30 days'),
  p_until TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  page_kind TEXT,
  city TEXT,
  impressions BIGINT,
  cta_signup BIGINT,
  cta_whatsapp BIGINT,
  cta_secondary BIGINT,
  dismiss BIGINT,
  post_signup_conversion BIGINT,
  signup_rate NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT page_kind, city, kind
    FROM public.exit_intent_events
    WHERE created_at >= p_since AND created_at < p_until
      AND public.has_role(auth.uid(), 'admin')
  )
  SELECT
    page_kind,
    city,
    COUNT(*) FILTER (WHERE kind = 'impression') AS impressions,
    COUNT(*) FILTER (WHERE kind = 'cta_signup') AS cta_signup,
    COUNT(*) FILTER (WHERE kind = 'cta_whatsapp') AS cta_whatsapp,
    COUNT(*) FILTER (WHERE kind = 'cta_secondary') AS cta_secondary,
    COUNT(*) FILTER (WHERE kind = 'dismiss') AS dismiss,
    COUNT(*) FILTER (WHERE kind = 'post_signup_conversion') AS post_signup_conversion,
    CASE WHEN COUNT(*) FILTER (WHERE kind = 'impression') > 0
         THEN ROUND( (COUNT(*) FILTER (WHERE kind = 'cta_signup'))::numeric
                     / COUNT(*) FILTER (WHERE kind = 'impression')::numeric, 4)
         ELSE 0
    END AS signup_rate
  FROM base
  GROUP BY page_kind, city
  ORDER BY impressions DESC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.admin_exit_intent_funnel(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_exit_intent_funnel(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;