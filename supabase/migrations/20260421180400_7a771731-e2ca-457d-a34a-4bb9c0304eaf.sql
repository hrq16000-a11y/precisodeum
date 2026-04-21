-- ============================================================
-- ENGAGEMENT LOOP MIGRATION
-- 1) create_album_atomic + add_portfolio_photo_atomic (DNA user_ref)
-- 2) get_profile_completeness (centralized weighted scoring)
-- 3) site_settings keys for portfolio limits (admin-controlled)
-- ============================================================

-- ---------- 1a) ATOMIC ALBUM CREATION ----------
CREATE OR REPLACE FUNCTION public.create_album_atomic(
  _name text,
  _description text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_provider RECORD;
  v_album_id uuid;
  v_display_order int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT id, user_ref INTO v_provider
    FROM public.providers
   WHERE user_id = v_user_id AND deleted_at IS NULL
   LIMIT 1;

  IF v_provider.id IS NULL THEN
    RAISE EXCEPTION 'Perfil profissional não encontrado';
  END IF;

  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'Nome do álbum é obrigatório';
  END IF;

  SELECT COALESCE(MAX(display_order), -1) + 1
    INTO v_display_order
    FROM public.portfolio_albums
   WHERE provider_id = v_provider.id;

  INSERT INTO public.portfolio_albums (
    provider_id, user_id, user_ref, name, description, display_order
  ) VALUES (
    v_provider.id, v_user_id, v_provider.user_ref,
    trim(_name), COALESCE(trim(_description), ''), v_display_order
  )
  RETURNING id INTO v_album_id;

  INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (
    v_user_id, 'album_create_atomic', 'portfolio_album', v_album_id::text,
    jsonb_build_object(
      'provider_id', v_provider.id,
      'user_ref', v_provider.user_ref,
      'name', trim(_name)
    )
  );

  RETURN jsonb_build_object(
    'id', v_album_id,
    'provider_id', v_provider.id,
    'user_ref', v_provider.user_ref
  );
END;
$$;

-- ---------- 1b) ATOMIC PHOTO INSERT ----------
CREATE OR REPLACE FUNCTION public.add_portfolio_photo_atomic(
  _album_id uuid,
  _image_url text,
  _storage_path text,
  _original_name text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_album RECORD;
  v_provider RECORD;
  v_photo_id uuid;
  v_display_order int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT a.*, p.user_ref AS provider_user_ref, p.user_id AS provider_user_id
    INTO v_album
    FROM public.portfolio_albums a
    JOIN public.providers p ON p.id = a.provider_id
   WHERE a.id = _album_id;

  IF v_album.id IS NULL THEN
    RAISE EXCEPTION 'Álbum não encontrado';
  END IF;

  IF v_album.provider_user_id <> v_user_id THEN
    RAISE EXCEPTION 'Acesso negado: álbum pertence a outro usuário';
  END IF;

  SELECT COALESCE(MAX(display_order), -1) + 1
    INTO v_display_order
    FROM public.portfolio_photos
   WHERE album_id = _album_id;

  INSERT INTO public.portfolio_photos (
    album_id, user_id, user_ref, image_url, storage_path, original_name, display_order
  ) VALUES (
    _album_id, v_user_id, v_album.provider_user_ref,
    _image_url, COALESCE(_storage_path, ''), COALESCE(_original_name, ''), v_display_order
  )
  RETURNING id INTO v_photo_id;

  -- Set first photo as cover when missing
  IF v_album.cover_image_url IS NULL OR v_album.cover_image_url = '' THEN
    UPDATE public.portfolio_albums
       SET cover_image_url = _image_url
     WHERE id = _album_id;
  END IF;

  INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (
    v_user_id, 'portfolio_photo_atomic', 'portfolio_photo', v_photo_id::text,
    jsonb_build_object(
      'album_id', _album_id,
      'provider_id', v_album.provider_id,
      'user_ref', v_album.provider_user_ref
    )
  );

  RETURN jsonb_build_object(
    'id', v_photo_id,
    'album_id', _album_id,
    'user_ref', v_album.provider_user_ref,
    'display_order', v_display_order
  );
END;
$$;

-- ---------- 2) CENTRALIZED COMPLETENESS RPC ----------
CREATE OR REPLACE FUNCTION public.get_profile_completeness(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider RECORD;
  v_profile RECORD;
  v_services_count int := 0;
  v_albums_count int := 0;
  v_photos_count int := 0;
  -- weights: photo 20, services 30, portfolio 30, data 20
  v_score int := 0;
  v_photo_pct int := 0;
  v_services_pct int := 0;
  v_portfolio_pct int := 0;
  v_data_pct int := 0;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = _user_id;
  SELECT * INTO v_provider FROM public.providers
    WHERE user_id = _user_id AND deleted_at IS NULL LIMIT 1;

  IF v_provider.id IS NULL THEN
    RETURN jsonb_build_object(
      'percentage', 0,
      'breakdown', jsonb_build_object('photo',0,'services',0,'portfolio',0,'data',0),
      'counts', jsonb_build_object('services',0,'albums',0,'photos',0)
    );
  END IF;

  SELECT COUNT(*) INTO v_services_count
    FROM public.services
   WHERE provider_id = v_provider.id AND deleted_at IS NULL;

  SELECT COUNT(*) INTO v_albums_count
    FROM public.portfolio_albums
   WHERE provider_id = v_provider.id;

  SELECT COUNT(*) INTO v_photos_count
    FROM public.portfolio_photos pp
    JOIN public.portfolio_albums pa ON pa.id = pp.album_id
   WHERE pa.provider_id = v_provider.id;

  -- Photo (20)
  IF (v_profile.avatar_url IS NOT NULL AND v_profile.avatar_url <> '')
     OR (v_provider.photo_url IS NOT NULL AND v_provider.photo_url <> '') THEN
    v_photo_pct := 20;
  END IF;

  -- Services (30) — full credit at 5
  v_services_pct := LEAST(30, (v_services_count * 6));

  -- Portfolio (30) — 10 for first album + up to 20 for 5 photos
  IF v_albums_count >= 1 THEN v_portfolio_pct := 10; END IF;
  v_portfolio_pct := v_portfolio_pct + LEAST(20, v_photos_count * 4);

  -- Data (20) — bio (8), city (4), whatsapp (4), category (4)
  IF length(COALESCE(v_provider.description,'')) >= 30 THEN v_data_pct := v_data_pct + 8; END IF;
  IF v_provider.city IS NOT NULL AND v_provider.city <> '' AND v_provider.city <> 'Não informada' THEN
    v_data_pct := v_data_pct + 4;
  END IF;
  IF (v_provider.whatsapp IS NOT NULL AND v_provider.whatsapp <> '')
     OR (v_profile.whatsapp IS NOT NULL AND v_profile.whatsapp <> '') THEN
    v_data_pct := v_data_pct + 4;
  END IF;
  IF v_provider.category_id IS NOT NULL THEN v_data_pct := v_data_pct + 4; END IF;

  v_score := LEAST(100, v_photo_pct + v_services_pct + v_portfolio_pct + v_data_pct);

  RETURN jsonb_build_object(
    'percentage', v_score,
    'breakdown', jsonb_build_object(
      'photo', v_photo_pct,
      'services', v_services_pct,
      'portfolio', v_portfolio_pct,
      'data', v_data_pct
    ),
    'counts', jsonb_build_object(
      'services', v_services_count,
      'albums', v_albums_count,
      'photos', v_photos_count
    )
  );
END;
$$;

-- ---------- 3) SITE SETTINGS for dynamic portfolio limits ----------
INSERT INTO public.site_settings (key, value, description)
VALUES
  ('portfolio_max_albums', '4'::jsonb, 'Limite máximo de álbuns por profissional'),
  ('portfolio_max_photos_per_album', '20'::jsonb, 'Limite máximo de fotos por álbum')
ON CONFLICT (key) DO NOTHING;