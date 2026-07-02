-- Remove trigger duplicado em providers
DROP TRIGGER IF EXISTS auto_approve_provider_trigger ON public.providers;

-- Recalc de engagement só na chamada de topo + nunca falha cadastro
CREATE OR REPLACE FUNCTION public.trg_recalc_engagement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF public._sync_in_progress() THEN RETURN NEW; END IF;
  PERFORM set_config('app.sync_in_progress','on', true);
  BEGIN PERFORM recalculate_engagement_points(NEW.user_id);
  EXCEPTION WHEN OTHERS THEN NULL; END;
  PERFORM set_config('app.sync_in_progress','off', true);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.trg_auto_level_on_points_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF NEW.engagement_points IS DISTINCT FROM OLD.engagement_points THEN
    BEGIN PERFORM calculate_user_level(NEW.id);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.trg_award_profile_complete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_has_provider boolean;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF public._sync_in_progress() THEN RETURN NEW; END IF;
  IF NEW.id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM providers
      WHERE user_id = NEW.id AND deleted_at IS NULL
        AND description IS NOT NULL AND LENGTH(description) > 50) INTO v_has_provider;
    IF v_has_provider AND (
        OLD.full_name IS DISTINCT FROM NEW.full_name
        OR OLD.phone IS DISTINCT FROM NEW.phone
        OR OLD.whatsapp IS DISTINCT FROM NEW.whatsapp) THEN
      BEGIN
        PERFORM set_config('app.sync_in_progress','on', true);
        PERFORM award_engagement_points(NEW.id, 'profile_completed',
          jsonb_build_object('field_changed', 'profile_data'));
        PERFORM set_config('app.sync_in_progress','off', true);
      EXCEPTION WHEN OTHERS THEN
        PERFORM set_config('app.sync_in_progress','off', true);
      END;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.trg_award_profile_photo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF public._sync_in_progress() THEN RETURN NEW; END IF;
  IF (OLD.avatar_url IS DISTINCT FROM NEW.avatar_url)
     AND NEW.avatar_url IS NOT NULL AND NEW.avatar_url <> '' THEN
    BEGIN
      PERFORM set_config('app.sync_in_progress','on', true);
      PERFORM award_engagement_points(NEW.id, 'profile_photo_uploaded', '{}'::jsonb);
      PERFORM set_config('app.sync_in_progress','off', true);
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('app.sync_in_progress','off', true);
    END;
  END IF;
  RETURN NEW;
END; $$;

-- Busca de cidades priorizada por UF
CREATE OR REPLACE FUNCTION public.search_cities_prioritized(term text, preferred_uf text DEFAULT NULL)
RETURNS TABLE(id uuid, name text, state text, state_uf text, priority int)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public','extensions','pg_catalog'
AS $$
  WITH q AS (
    SELECT extensions.unaccent(lower(coalesce(btrim(term),''))) AS qn,
           upper(coalesce(btrim(preferred_uf),'')) AS uf
  )
  SELECT c.id, c.name, c.state, c.state_uf,
    CASE WHEN q.uf <> '' AND upper(coalesce(c.state_uf, c.state, '')) = q.uf THEN 0 ELSE 1 END AS priority
  FROM public.cities c, q
  WHERE q.qn = '' OR extensions.unaccent(lower(c.name)) LIKE q.qn || '%'
  ORDER BY priority ASC, c.name ASC
  LIMIT 30;
$$;

GRANT EXECUTE ON FUNCTION public.search_cities_prioritized(text, text) TO anon, authenticated;