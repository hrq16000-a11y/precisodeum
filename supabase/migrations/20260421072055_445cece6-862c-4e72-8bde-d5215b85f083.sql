-- Approval workflow columns for sponsors
ALTER TABLE public.sponsors
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

-- RPC: aggregated metrics per sponsor (admin only)
CREATE OR REPLACE FUNCTION public.admin_sponsor_metrics_summary(_sponsor_ids uuid[])
RETURNS TABLE (sponsor_id uuid, total_impressions bigint, total_clicks bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sm.sponsor_id,
         COALESCE(SUM(CASE WHEN sm.event_type='impression' THEN sm.count END),0)::bigint AS total_impressions,
         COALESCE(SUM(CASE WHEN sm.event_type='click'      THEN sm.count END),0)::bigint AS total_clicks
  FROM public.sponsor_metrics sm
  WHERE sm.sponsor_id = ANY(_sponsor_ids)
    AND public.has_role(auth.uid(),'admin'::app_role)
  GROUP BY sm.sponsor_id;
$$;

GRANT EXECUTE ON FUNCTION public.admin_sponsor_metrics_summary(uuid[]) TO authenticated;