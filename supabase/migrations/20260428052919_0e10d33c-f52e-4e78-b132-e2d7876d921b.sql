CREATE OR REPLACE FUNCTION public.recompute_provider_verified(_provider_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  v_p              public.providers%ROWTYPE;
  v_has_service    boolean;
  v_wa_digits      text;
  v_wa_local       text;
  v_criteria       jsonb;
  v_all_passed     boolean;
  v_reason         text;
BEGIN
  SELECT * INTO v_p FROM public.providers WHERE id = _provider_id;
  IF NOT FOUND THEN RETURN '{}'::jsonb; END IF;

  IF v_p.verified_manual = true THEN
    RETURN COALESCE(v_p.verified_criteria, '{}'::jsonb)
        || jsonb_build_object('skipped_manual', true);
  END IF;

  v_wa_digits := regexp_replace(COALESCE(v_p.whatsapp, ''), '\D', '', 'g');
  -- Remove DDI 55 se presente para comparar com 10-11 dígitos locais.
  v_wa_local  := CASE
    WHEN length(v_wa_digits) IN (12, 13) AND substring(v_wa_digits, 1, 2) = '55'
      THEN substring(v_wa_digits, 3)
    ELSE v_wa_digits
  END;

  v_has_service := EXISTS (
    SELECT 1 FROM public.services s
    WHERE s.provider_id = _provider_id
      AND s.deleted_at IS NULL
  );

  v_criteria := jsonb_build_object(
    'profile_min_complete', jsonb_build_object(
      'photo',       (NULLIF(trim(COALESCE(v_p.photo_url,'')),'') IS NOT NULL),
      'description', (length(trim(COALESCE(v_p.description,''))) >= 30),
      'service',     v_has_service
    ),
    'contact_geo_complete', jsonb_build_object(
      'whatsapp', (length(v_wa_local) BETWEEN 10 AND 11),
      'city',     (NULLIF(trim(COALESCE(v_p.city,'')),'') IS NOT NULL),
      'gps',      (v_p.latitude IS NOT NULL AND v_p.longitude IS NOT NULL)
    )
  );

  v_all_passed :=
        (v_criteria->'profile_min_complete'->>'photo')::boolean
    AND (v_criteria->'profile_min_complete'->>'description')::boolean
    AND (v_criteria->'profile_min_complete'->>'service')::boolean
    AND (v_criteria->'contact_geo_complete'->>'whatsapp')::boolean
    AND (v_criteria->'contact_geo_complete'->>'city')::boolean
    AND (v_criteria->'contact_geo_complete'->>'gps')::boolean;

  v_reason := CASE
    WHEN v_all_passed THEN 'Cumpre todos os criterios automaticos: perfil minimo + contato/geo completos.'
    ELSE 'Criterios automaticos pendentes - preencha foto, descricao (>=30), 1 servico, WhatsApp valido, cidade e GPS.'
  END;

  UPDATE public.providers
     SET is_verified       = v_all_passed,
         verified_at       = CASE
                               WHEN v_all_passed AND is_verified = false THEN now()
                               WHEN v_all_passed THEN COALESCE(verified_at, now())
                               ELSE NULL
                             END,
         verified_reason   = v_reason,
         verified_by       = NULL,
         verified_manual   = false,
         verified_criteria = v_criteria
   WHERE id = _provider_id;

  RETURN v_criteria || jsonb_build_object('is_verified', v_all_passed);
END;
$$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.providers WHERE status = 'approved' LIMIT 5000 LOOP
    PERFORM public.recompute_provider_verified(r.id);
  END LOOP;
END $$;