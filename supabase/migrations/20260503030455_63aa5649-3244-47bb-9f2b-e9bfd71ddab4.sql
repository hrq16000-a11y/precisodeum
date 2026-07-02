-- RPC server-side para finalizar o onboarding em uma única transação.
-- Substitui o UPDATE direto que era feito do client em src/lib/finalizeOnboarding.ts,
-- garantindo atomicidade dos 3 campos canônicos (onboarding_completed,
-- onboarding_step, profile_type) e isolando a regra de finalização do client.
CREATE OR REPLACE FUNCTION public.finalize_onboarding_atomic(
  _user_id uuid,
  _profile_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_rows int;
BEGIN
  -- 1) Auth obrigatória + caller só pode finalizar a si mesmo.
  IF v_caller IS NULL OR v_caller <> _user_id THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'unauthorized'
    );
  END IF;

  -- 2) Whitelist de profile_type para evitar valores arbitrários.
  IF _profile_type IS NULL
     OR _profile_type NOT IN ('provider', 'client', 'rh') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'invalid_profile_type'
    );
  END IF;

  -- 3) UPDATE atômico dos 3 campos governados.
  UPDATE public.profiles
     SET onboarding_completed = true,
         onboarding_step = 5,
         profile_type = _profile_type,
         updated_at = now()
   WHERE id = _user_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'profile_not_found'
    );
  END IF;

  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'ok', false,
    'error', SQLERRM
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_onboarding_atomic(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_onboarding_atomic(uuid, text) TO authenticated;