-- Add PRO plan columns to sponsors table
ALTER TABLE public.sponsors
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS guaranteed_impressions integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS delivered_impressions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS campaign_start timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS campaign_end timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS needs_compensation boolean NOT NULL DEFAULT false;

-- Update track_sponsor_metric to increment delivered_impressions for PRO sponsors
CREATE OR REPLACE FUNCTION public.track_sponsor_metric(_sponsor_id uuid, _slot_slug text, _event_type text, _page_path text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.sponsor_metrics (sponsor_id, slot_slug, event_type, page_path, event_date, count)
  VALUES (_sponsor_id, _slot_slug, _event_type, _page_path, CURRENT_DATE, 1)
  ON CONFLICT DO NOTHING;
  
  -- Update legacy counters
  IF _event_type = 'impression' THEN
    UPDATE public.sponsors SET impressions = impressions + 1 WHERE id = _sponsor_id;
    -- Increment delivered_impressions for PRO sponsors
    UPDATE public.sponsors 
    SET delivered_impressions = delivered_impressions + 1 
    WHERE id = _sponsor_id AND plan = 'pro';
  ELSIF _event_type = 'click' THEN
    UPDATE public.sponsors SET clicks = clicks + 1 WHERE id = _sponsor_id;
  END IF;
END;
$function$;