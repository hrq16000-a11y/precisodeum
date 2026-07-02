-- Indexes to support list_whatsapp_contacts_history at scale.
-- The hot path filters by (user_id) and orders by clicked_at DESC — already
-- covered by idx_whatsapp_clicks_user_clicked_at. The sort-by-provider path
-- benefits from a functional lower(business_name) index on providers.

CREATE INDEX IF NOT EXISTS idx_providers_business_name_lower
  ON public.providers (lower(business_name));

-- Helps the "is_today" classification and any per-user/day analytics.
-- Already exists as idx_whatsapp_clicks_user_day; ensured here for safety.
CREATE INDEX IF NOT EXISTS idx_whatsapp_clicks_user_day
  ON public.whatsapp_clicks_log (user_id, clicked_on_utc);

-- Composite for the "recurring" window function (provider_id partition
-- restricted to a single user). Keeps per-user provider grouping cheap.
CREATE INDEX IF NOT EXISTS idx_whatsapp_clicks_user_provider
  ON public.whatsapp_clicks_log (user_id, provider_id);

ANALYZE public.whatsapp_clicks_log;
ANALYZE public.providers;