
INSERT INTO public.site_settings (key, value, label, description, is_public)
VALUES (
  'service_quality_min_score',
  '60'::jsonb,
  'Score mínimo SEO',
  'Pontuação mínima (0-100) para um serviço aparecer nas páginas SEO de categoria/cidade.',
  true
)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_list_kill_switch_blocks(
  p_provider_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_limit int DEFAULT 200
)
RETURNS TABLE (
  id uuid,
  service_id uuid,
  provider_id uuid,
  provider_name text,
  reason text,
  source text,
  attempt_payload jsonb,
  previous_value text,
  new_value text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sac.id,
    sac.service_id,
    sac.provider_id,
    COALESCE(pr.business_name, pr.legal_name) AS provider_name,
    sac.reason,
    sac.source,
    sac.attempt_payload,
    sac.previous_value,
    sac.new_value,
    sac.created_at
  FROM public.service_area_corrections sac
  LEFT JOIN public.providers pr ON pr.id = sac.provider_id
  WHERE
    public.has_role(auth.uid(), 'admin'::public.app_role)
    AND sac.blocked = true
    AND (p_provider_id IS NULL OR sac.provider_id = p_provider_id)
    AND (p_from IS NULL OR sac.created_at >= p_from)
    AND (p_to IS NULL OR sac.created_at <= p_to)
  ORDER BY sac.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 200), 1);
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_kill_switch_blocks(uuid, timestamptz, timestamptz, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_reprocess_kill_switch_block(
  p_correction_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.service_area_corrections%ROWTYPE;
  v_provider_city text;
  v_service_exists boolean := false;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.service_area_corrections WHERE id = p_correction_id;
  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  SELECT city INTO v_provider_city FROM public.providers WHERE id = v_row.provider_id;

  IF v_row.service_id IS NOT NULL THEN
    SELECT true INTO v_service_exists FROM public.services WHERE id = v_row.service_id LIMIT 1;
  END IF;

  IF v_service_exists AND v_provider_city IS NOT NULL THEN
    UPDATE public.services
    SET service_area = v_provider_city
    WHERE id = v_row.service_id;
  END IF;

  INSERT INTO public.service_area_corrections (
    service_id, provider_id, previous_value, new_value, reason, source, corrected_by, blocked, attempt_payload
  ) VALUES (
    v_row.service_id,
    v_row.provider_id,
    v_row.previous_value,
    v_provider_city,
    'kill_switch_manual_reprocess',
    'admin_manual',
    auth.uid(),
    false,
    jsonb_build_object('original_correction_id', v_row.id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'service_updated', v_service_exists,
    'new_service_area', v_provider_city
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reprocess_kill_switch_block(uuid) TO authenticated;
