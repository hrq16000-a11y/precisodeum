-- 2B: Identity Suggestions apply/dismiss with audit + helper for badge

-- RPC: apply or dismiss a profile change suggestion
-- Operates only on the user's own suggestion. Writes to audit_log on apply.
CREATE OR REPLACE FUNCTION public.resolve_identity_suggestion(
  _suggestion_id uuid,
  _action text  -- 'apply' | 'dismiss'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.profile_change_suggestions%ROWTYPE;
  v_old_value text;
  v_target_field text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF _action NOT IN ('apply','dismiss') THEN
    RAISE EXCEPTION 'invalid action';
  END IF;

  SELECT * INTO v_row
  FROM public.profile_change_suggestions
  WHERE id = _suggestion_id AND user_id = v_uid
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','not_found');
  END IF;

  IF v_row.status <> 'pending' THEN
    RETURN jsonb_build_object('status','already_resolved', 'previous', v_row.status);
  END IF;

  IF _action = 'dismiss' THEN
    UPDATE public.profile_change_suggestions
       SET status = 'dismissed', resolved_at = now()
     WHERE id = _suggestion_id;
    RETURN jsonb_build_object('status','dismissed');
  END IF;

  -- Apply: only allow specific identity fields
  v_target_field := lower(v_row.field);
  IF v_target_field NOT IN ('full_name','display_name','tax_id','document','whatsapp','phone') THEN
    RAISE EXCEPTION 'field % not allowed for self-apply', v_target_field;
  END IF;

  -- Read previous value for audit
  EXECUTE format(
    'SELECT %I::text FROM public.profiles WHERE id = $1',
    CASE WHEN v_target_field = 'document' THEN 'tax_id' ELSE v_target_field END
  )
  INTO v_old_value
  USING v_uid;

  -- Apply update
  EXECUTE format(
    'UPDATE public.profiles SET %I = $1, updated_at = now() WHERE id = $2',
    CASE WHEN v_target_field = 'document' THEN 'tax_id' ELSE v_target_field END
  )
  USING v_row.suggested_value, v_uid;

  UPDATE public.profile_change_suggestions
     SET status = 'applied', resolved_at = now()
   WHERE id = _suggestion_id;

  -- Audit (best-effort)
  BEGIN
    INSERT INTO public.audit_log (user_id, action, target_type, target_id, metadata)
    VALUES (
      v_uid,
      'identity_suggestion_applied',
      'profile',
      v_uid,
      jsonb_build_object(
        'field', v_target_field,
        'old_value', v_old_value,
        'new_value', v_row.suggested_value,
        'source', v_row.source,
        'suggestion_id', v_row.id
      )
    );
  EXCEPTION WHEN others THEN
    -- silently ignore audit failure to not block the user action
    NULL;
  END;

  RETURN jsonb_build_object(
    'status','applied',
    'field', v_target_field,
    'new_value', v_row.suggested_value
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_identity_suggestion(uuid, text) TO authenticated;

-- Helper: returns true when the provider matches "Profissional Top" criteria
-- (tier >= 'ativo') AND mission_answers contains both verify_name and verify_whatsapp truthy.
CREATE OR REPLACE FUNCTION public.is_top_professional(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier jsonb;
  v_tier_name text;
  v_answers jsonb;
  v_name_ok boolean;
  v_wa_ok boolean;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;

  -- Reuse maturity tier RPC if available
  BEGIN
    v_tier := public.get_user_maturity_tier(_user_id);
    v_tier_name := COALESCE(v_tier->>'tier','novato');
  EXCEPTION WHEN others THEN
    v_tier_name := 'novato';
  END;

  IF v_tier_name NOT IN ('ativo','veterano') THEN
    RETURN false;
  END IF;

  SELECT mission_answers INTO v_answers
  FROM public.providers
  WHERE user_id = _user_id
  LIMIT 1;

  IF v_answers IS NULL THEN RETURN false; END IF;

  v_name_ok := COALESCE((v_answers->>'verify_name')::text, '') IN ('true','yes','1','confirmed');
  v_wa_ok   := COALESCE((v_answers->>'verify_whatsapp')::text, '') IN ('true','yes','1','confirmed');

  RETURN v_name_ok AND v_wa_ok;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_top_professional(uuid) TO anon, authenticated;