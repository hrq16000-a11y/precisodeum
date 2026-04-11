
-- 1. Move ghost providers (approved but no city) to pending
UPDATE public.providers
SET status = 'pending', updated_at = now()
WHERE status = 'approved'
  AND deleted_at IS NULL
  AND (city IS NULL OR city = '' OR city = 'Não informada');

-- 2. Harden auto_approve trigger to require city
CREATE OR REPLACE FUNCTION public.auto_approve_provider()
RETURNS TRIGGER AS $$
DECLARE
  should_auto boolean;
BEGIN
  SELECT (value->>'enabled')::boolean INTO should_auto
  FROM public.governance_rules
  WHERE key = 'auto_approve_providers' AND status = 'active'
  LIMIT 1;

  IF should_auto IS TRUE
     AND NEW.status = 'pending'
     AND COALESCE(NEW.city, '') <> ''
     AND NEW.city <> 'Não informada'
     AND COALESCE(NEW.state, '') <> ''
  THEN
    NEW.status := 'approved';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
