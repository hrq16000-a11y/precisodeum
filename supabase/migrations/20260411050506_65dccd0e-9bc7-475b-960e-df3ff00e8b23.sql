
-- Function to sync portfolio_photo_count from media table
CREATE OR REPLACE FUNCTION public.sync_portfolio_count_from_media()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_ref text;
  v_user_id uuid;
  v_provider_id uuid;
  v_count integer;
BEGIN
  -- Get the relevant user_ref
  IF TG_OP = 'DELETE' THEN
    v_user_ref := OLD.user_ref;
  ELSE
    v_user_ref := NEW.user_ref;
  END IF;

  -- Only act on portfolio entity_type
  IF (TG_OP = 'DELETE' AND OLD.entity_type != 'portfolio') THEN RETURN OLD; END IF;
  IF (TG_OP != 'DELETE' AND NEW.entity_type != 'portfolio') THEN RETURN COALESCE(NEW, OLD); END IF;

  -- Skip unlinked
  IF v_user_ref IS NULL OR v_user_ref = 'unlinked' THEN RETURN COALESCE(NEW, OLD); END IF;

  -- Find user_id from profiles
  SELECT id INTO v_user_id FROM profiles WHERE user_ref = v_user_ref LIMIT 1;
  IF v_user_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  -- Find provider_id
  SELECT id INTO v_provider_id FROM providers WHERE user_id = v_user_id AND deleted_at IS NULL LIMIT 1;
  IF v_provider_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  -- Count active portfolio media
  SELECT COUNT(*) INTO v_count
  FROM media
  WHERE user_ref = v_user_ref
    AND entity_type = 'portfolio'
    AND is_active = true;

  -- Update provider
  UPDATE providers SET portfolio_photo_count = v_count WHERE id = v_provider_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger on media table
DROP TRIGGER IF EXISTS trg_sync_portfolio_count_media ON public.media;
CREATE TRIGGER trg_sync_portfolio_count_media
AFTER INSERT OR DELETE OR UPDATE OF is_active, entity_type ON public.media
FOR EACH ROW
EXECUTE FUNCTION public.sync_portfolio_count_from_media();

-- Ensure destaque_require_description setting exists
INSERT INTO public.site_settings (key, label, description, value, is_public)
VALUES ('destaque_require_description', 'DESTAQUE: Exigir descrição', 'Exigir que o profissional tenha descrição preenchida para receber selo DESTAQUE', 'false', false)
ON CONFLICT (key) DO NOTHING;
