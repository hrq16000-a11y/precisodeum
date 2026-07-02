-- Add score columns to leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lead_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_factors jsonb DEFAULT '{}';

-- Create index for score-based queries
CREATE INDEX IF NOT EXISTS idx_leads_score ON public.leads (lead_score DESC);

-- Create scoring function
CREATE OR REPLACE FUNCTION public.calculate_lead_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_score integer := 0;
  v_factors jsonb := '{}';
  v_provider_plan text;
  v_name_len integer;
  v_phone_len integer;
  v_msg_len integer;
  v_age_hours numeric;
BEGIN
  -- 1. Client name quality (max 15)
  v_name_len := LENGTH(TRIM(COALESCE(NEW.client_name, '')));
  IF v_name_len > 0 AND POSITION(' ' IN TRIM(NEW.client_name)) > 0 THEN
    v_score := v_score + 15;
    v_factors := v_factors || '{"name": 15}';
  ELSIF v_name_len > 0 THEN
    v_score := v_score + 8;
    v_factors := v_factors || '{"name": 8}';
  ELSE
    v_factors := v_factors || '{"name": 0}';
  END IF;

  -- 2. Phone quality (max 20)
  v_phone_len := LENGTH(REGEXP_REPLACE(COALESCE(NEW.phone, ''), '[^0-9]', '', 'g'));
  IF v_phone_len >= 12 THEN
    v_score := v_score + 20;
    v_factors := v_factors || '{"phone": 20}';
  ELSIF v_phone_len >= 10 THEN
    v_score := v_score + 15;
    v_factors := v_factors || '{"phone": 15}';
  ELSIF v_phone_len > 0 THEN
    v_score := v_score + 5;
    v_factors := v_factors || '{"phone": 5}';
  ELSE
    v_factors := v_factors || '{"phone": 0}';
  END IF;

  -- 3. Service needed (max 20)
  IF TRIM(COALESCE(NEW.service_needed, '')) != '' THEN
    v_score := v_score + 20;
    v_factors := v_factors || '{"service": 20}';
  ELSE
    v_factors := v_factors || '{"service": 0}';
  END IF;

  -- 4. Message quality (max 15)
  v_msg_len := LENGTH(TRIM(COALESCE(NEW.message, '')));
  IF v_msg_len > 20 THEN
    v_score := v_score + 15;
    v_factors := v_factors || '{"message": 15}';
  ELSIF v_msg_len > 0 THEN
    v_score := v_score + 5;
    v_factors := v_factors || '{"message": 5}';
  ELSE
    v_factors := v_factors || '{"message": 0}';
  END IF;

  -- 5. Provider plan quality (max 15)
  SELECT p.plan INTO v_provider_plan
  FROM providers p WHERE p.id = NEW.provider_id;

  IF v_provider_plan = 'premium' THEN
    v_score := v_score + 15;
    v_factors := v_factors || '{"provider_plan": 15}';
  ELSE
    v_score := v_score + 5;
    v_factors := v_factors || '{"provider_plan": 5}';
  END IF;

  -- 6. Recency (max 15)
  v_age_hours := EXTRACT(EPOCH FROM (now() - COALESCE(NEW.created_at, now()))) / 3600.0;
  IF v_age_hours <= 24 THEN
    v_score := v_score + 15;
    v_factors := v_factors || '{"recency": 15}';
  ELSIF v_age_hours <= 168 THEN
    v_score := v_score + 10;
    v_factors := v_factors || '{"recency": 10}';
  ELSIF v_age_hours <= 720 THEN
    v_score := v_score + 5;
    v_factors := v_factors || '{"recency": 5}';
  ELSE
    v_factors := v_factors || '{"recency": 0}';
  END IF;

  -- Cap at 100
  NEW.lead_score := LEAST(v_score, 100);
  NEW.score_factors := v_factors;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_calculate_lead_score ON public.leads;
CREATE TRIGGER trg_calculate_lead_score
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_lead_score();

-- Backfill existing leads
UPDATE public.leads SET lead_score = 0 WHERE lead_score = 0;