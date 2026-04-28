-- =============================================================================
-- SELO "PROFISSIONAL TOP" (is_verified) — camada paralela ao community_verified
-- =============================================================================

-- 1) Schema -------------------------------------------------------------------
ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS is_verified       boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at       timestamptz,
  ADD COLUMN IF NOT EXISTS verified_reason   text,
  ADD COLUMN IF NOT EXISTS verified_by       uuid,
  ADD COLUMN IF NOT EXISTS verified_manual   boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_criteria jsonb        NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_providers_is_verified
  ON public.providers (is_verified) WHERE is_verified = true;

COMMENT ON COLUMN public.providers.is_verified
  IS 'Selo "Profissional Top". Recomputado automaticamente OU forçado por admin (verified_manual=true).';
COMMENT ON COLUMN public.providers.verified_criteria
  IS 'Snapshot dos criterios cumpridos na ultima recomputacao (foto, descricao, servico, whatsapp, cidade, geo).';
COMMENT ON COLUMN public.providers.verified_manual
  IS 'true quando admin marcou/desmarcou manualmente — recompute_provider_verified preserva esse estado.';

-- 2) Função de recomputação ---------------------------------------------------
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

  v_wa_digits   := regexp_replace(COALESCE(v_p.whatsapp, ''), '\D', '', 'g');
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
      'whatsapp', (length(v_wa_digits) BETWEEN 10 AND 11),
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

GRANT EXECUTE ON FUNCTION public.recompute_provider_verified(uuid) TO authenticated;

-- 3) Triggers automáticos ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_recompute_verified_on_provider()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND
     NEW.is_verified IS DISTINCT FROM OLD.is_verified AND
     NEW.verified_criteria IS DISTINCT FROM OLD.verified_criteria THEN
    RETURN NEW;
  END IF;
  PERFORM public.recompute_provider_verified(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_provider_recompute_verified ON public.providers;
CREATE TRIGGER trg_provider_recompute_verified
  AFTER INSERT OR UPDATE OF photo_url, description, whatsapp, city, latitude, longitude
  ON public.providers
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_recompute_verified_on_provider();

CREATE OR REPLACE FUNCTION public.trg_recompute_verified_on_service()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pid uuid;
BEGIN
  v_pid := COALESCE(NEW.provider_id, OLD.provider_id);
  IF v_pid IS NOT NULL THEN
    PERFORM public.recompute_provider_verified(v_pid);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_service_recompute_verified ON public.services;
CREATE TRIGGER trg_service_recompute_verified
  AFTER INSERT OR UPDATE OF deleted_at OR DELETE
  ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_recompute_verified_on_service();

-- 4) Override manual do admin --------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_provider_verified(
  _provider_id uuid,
  _verified    boolean,
  _reason      text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old public.providers%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  IF _reason IS NULL OR length(trim(_reason)) < 5 THEN
    RAISE EXCEPTION 'reason required (minimo 5 caracteres)';
  END IF;

  SELECT * INTO v_old FROM public.providers WHERE id = _provider_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'provider not found';
  END IF;

  UPDATE public.providers
     SET is_verified     = _verified,
         verified_at     = CASE WHEN _verified THEN now() ELSE NULL END,
         verified_reason = trim(_reason),
         verified_by     = v_uid,
         verified_manual = true
   WHERE id = _provider_id;

  BEGIN
    INSERT INTO public.audit_log (actor_id, action, target_type, target_id, before, after)
    VALUES (
      v_uid,
      CASE WHEN _verified THEN 'provider.verified.set' ELSE 'provider.verified.unset' END,
      'provider',
      _provider_id,
      jsonb_build_object('is_verified', v_old.is_verified, 'verified_manual', v_old.verified_manual),
      jsonb_build_object('is_verified', _verified, 'verified_manual', true, 'reason', trim(_reason))
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'provider_id', _provider_id,
    'is_verified', _verified,
    'verified_by', v_uid,
    'verified_at', CASE WHEN _verified THEN now() ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_provider_verified(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_provider_verified(uuid, boolean, text) TO authenticated;

-- 5) Recomputação inicial (backfill) ------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.providers WHERE status = 'approved' LIMIT 5000 LOOP
    PERFORM public.recompute_provider_verified(r.id);
  END LOOP;
END $$;