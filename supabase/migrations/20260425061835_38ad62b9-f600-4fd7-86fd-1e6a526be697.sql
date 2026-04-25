-- RPC: completa missão "app_installed" (+30 pontos, idempotente) e audita
CREATE OR REPLACE FUNCTION public.complete_app_install_mission()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid;
  v_user_id uuid := auth.uid();
  v_inserted boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT id INTO v_provider_id
    FROM public.providers
   WHERE user_id = v_user_id
   LIMIT 1;

  IF v_provider_id IS NULL THEN
    RETURN jsonb_build_object('status', 'no_provider', 'points_awarded', 0);
  END IF;

  -- Idempotente: tenta inserir; se já existe, não credita de novo
  INSERT INTO public.mission_completions (provider_id, user_id, mission_key, points_awarded)
  VALUES (v_provider_id, v_user_id, 'app_installed', 30)
  ON CONFLICT (provider_id, mission_key) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted THEN
    -- Credita os 30 pontos no profile
    UPDATE public.profiles
       SET engagement_points = COALESCE(engagement_points, 0) + 30,
           updated_at = now()
     WHERE id = v_user_id;

    -- Marca também em mission_answers (sem disparar +5 do trigger pq já existe registro)
    UPDATE public.providers
       SET mission_answers = COALESCE(mission_answers, '{}'::jsonb)
                             || jsonb_build_object('app_installed', to_jsonb(now())),
           updated_at = now()
     WHERE id = v_provider_id;

    -- Audita
    BEGIN
      INSERT INTO public.audit_log (actor_user_id, action, target_type, target_id, snapshot)
      VALUES (v_user_id, 'pwa_app_installed', 'provider', v_provider_id,
              jsonb_build_object('points_awarded', 30, 'at', now()));
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      NULL; -- audit_log opcional
    END;

    RETURN jsonb_build_object('status', 'granted', 'points_awarded', 30);
  END IF;

  RETURN jsonb_build_object('status', 'already_completed', 'points_awarded', 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_app_install_mission() TO authenticated;

-- RPC auxiliar: registra início do fluxo de instalação (analytics)
CREATE OR REPLACE FUNCTION public.log_pwa_install_event(_event text, _meta jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RETURN; END IF;
  IF _event NOT IN ('install_prompted','install_accepted','install_dismissed','standalone_opened') THEN
    RAISE EXCEPTION 'invalid_event';
  END IF;
  BEGIN
    INSERT INTO public.audit_log (actor_user_id, action, target_type, target_id, snapshot)
    VALUES (v_user_id, 'pwa_'||_event, 'profile', v_user_id, COALESCE(_meta,'{}'::jsonb));
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_pwa_install_event(text, jsonb) TO authenticated;