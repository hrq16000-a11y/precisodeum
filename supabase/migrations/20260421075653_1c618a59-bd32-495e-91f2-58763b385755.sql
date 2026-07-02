CREATE OR REPLACE FUNCTION public.trg_award_onboarding_first_service()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_count int;
  v_already boolean;
BEGIN
  SELECT p.user_id
    INTO v_user_id
  FROM public.providers p
  WHERE p.id = NEW.provider_id;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
    INTO v_count
  FROM public.services s
  JOIN public.providers p ON p.id = s.provider_id
  WHERE p.user_id = v_user_id
    AND s.deleted_at IS NULL;

  IF v_count = 1 THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.engagement_log
      WHERE user_id = v_user_id
        AND action_key = 'onboarding_first_service'
    ) INTO v_already;

    IF NOT v_already THEN
      PERFORM public.award_engagement_points(
        v_user_id,
        'onboarding_first_service',
        jsonb_build_object('service_id', NEW.id, 'provider_id', NEW.provider_id)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;