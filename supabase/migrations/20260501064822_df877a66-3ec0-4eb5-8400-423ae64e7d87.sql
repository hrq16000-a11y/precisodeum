-- ============================================================
-- 1) IMUTABILIDADE DE registration_snapshots
-- ============================================================
ALTER TABLE public.registration_snapshots
  ADD COLUMN IF NOT EXISTS auth_provider text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'registration_snapshots_user_id_unique'
  ) THEN
    DELETE FROM public.registration_snapshots a
    USING public.registration_snapshots b
    WHERE a.user_id = b.user_id AND a.captured_at > b.captured_at;
    ALTER TABLE public.registration_snapshots
      ADD CONSTRAINT registration_snapshots_user_id_unique UNIQUE (user_id);
  END IF;
END$$;

CREATE OR REPLACE FUNCTION public.registration_snapshots_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.allow_snapshot_admin_override', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  RAISE EXCEPTION 'registration_snapshots is immutable: % is not allowed', TG_OP
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_registration_snapshots_immutable ON public.registration_snapshots;
CREATE TRIGGER trg_registration_snapshots_immutable
  BEFORE UPDATE OR DELETE ON public.registration_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.registration_snapshots_immutable();

-- ============================================================
-- 2) FLAG accepts_on_demand + nova assinatura de derive_working_hours_flags
-- ============================================================
ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS accepts_on_demand boolean NOT NULL DEFAULT false;
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS accepts_on_demand boolean NOT NULL DEFAULT false;

-- Drop dependentes para poder mudar return type
DROP TRIGGER IF EXISTS trg_apply_working_hours_flags_providers ON public.providers;
DROP TRIGGER IF EXISTS trg_apply_working_hours_flags_services ON public.services;
DROP FUNCTION IF EXISTS public.apply_working_hours_flags();
DROP FUNCTION IF EXISTS public.derive_working_hours_flags(jsonb);

CREATE FUNCTION public.derive_working_hours_flags(_struct jsonb)
RETURNS TABLE (
  opens_weekend boolean,
  opens_late_night boolean,
  opens_overnight boolean,
  is_24h boolean,
  accepts_on_demand boolean
)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  r jsonb;
  d text;
  s_start text;
  s_end text;
  start_min int;
  end_min int;
  ranges jsonb;
  has_weekend boolean := false;
  has_late boolean := false;
  has_overnight boolean := false;
  has_24h boolean := false;
BEGIN
  IF _struct IS NULL OR jsonb_typeof(_struct) <> 'object' THEN
    RETURN QUERY SELECT false, false, false, false, true;
    RETURN;
  END IF;

  ranges := COALESCE(_struct->'ranges', '[]'::jsonb);
  IF jsonb_array_length(ranges) = 0 THEN
    RETURN QUERY SELECT false, false, false, false, true;
    RETURN;
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(ranges) LOOP
    s_start := r->>'start';
    s_end := r->>'end';
    IF s_start IS NULL OR s_end IS NULL THEN CONTINUE; END IF;
    start_min := (split_part(s_start, ':', 1))::int * 60 + (split_part(s_start, ':', 2))::int;
    end_min := (split_part(s_end, ':', 1))::int * 60 + (split_part(s_end, ':', 2))::int;

    FOR d IN SELECT jsonb_array_elements_text(COALESCE(r->'days','[]'::jsonb)) LOOP
      IF d IN ('sat','sun') THEN has_weekend := true; END IF;
    END LOOP;

    IF end_min = 0 OR end_min > 20*60 OR end_min < start_min THEN
      has_late := true;
    END IF;

    IF (start_min >= 0 AND start_min < 6*60) OR end_min < start_min THEN
      has_overnight := true;
    END IF;

    IF (s_start = '00:00' AND (s_end = '00:00' OR s_end = '24:00')) THEN
      has_24h := true;
    END IF;
  END LOOP;

  RETURN QUERY SELECT has_weekend, has_late, has_overnight, has_24h, false;
END;
$$;

CREATE FUNCTION public.apply_working_hours_flags()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE flags record;
BEGIN
  SELECT * INTO flags FROM public.derive_working_hours_flags(NEW.working_hours_struct);
  NEW.opens_weekend := flags.opens_weekend;
  NEW.opens_late_night := flags.opens_late_night;
  NEW.opens_overnight := flags.opens_overnight;
  NEW.is_24h := flags.is_24h;
  NEW.accepts_on_demand := flags.accepts_on_demand;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_working_hours_flags_providers
  BEFORE INSERT OR UPDATE OF working_hours_struct ON public.providers
  FOR EACH ROW EXECUTE FUNCTION public.apply_working_hours_flags();

CREATE TRIGGER trg_apply_working_hours_flags_services
  BEFORE INSERT OR UPDATE OF working_hours_struct ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.apply_working_hours_flags();

-- Backfill
UPDATE public.providers SET working_hours_struct = working_hours_struct WHERE working_hours_struct IS NOT NULL;
UPDATE public.services SET working_hours_struct = working_hours_struct WHERE working_hours_struct IS NOT NULL;
UPDATE public.providers SET accepts_on_demand = true WHERE working_hours_struct IS NULL AND accepts_on_demand = false;
UPDATE public.services SET accepts_on_demand = true WHERE working_hours_struct IS NULL AND accepts_on_demand = false;