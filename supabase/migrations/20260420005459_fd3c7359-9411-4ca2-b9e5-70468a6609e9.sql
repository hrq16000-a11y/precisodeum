-- 1) Tabela de configurações do onboarding (gerenciável pelo admin)
CREATE TABLE IF NOT EXISTS public.onboarding_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  active boolean NOT NULL DEFAULT true,
  title text NOT NULL DEFAULT 'Bem-vindo! Como você quer usar a plataforma?',
  subtitle text NOT NULL DEFAULT 'Escolha o perfil que melhor descreve você. Você pode mudar depois.',
  -- 3 cards
  card1_icon text NOT NULL DEFAULT 'Briefcase',
  card1_title text NOT NULL DEFAULT 'Sou Profissional',
  card1_description text NOT NULL DEFAULT 'Quero divulgar meus serviços e receber clientes.',
  card1_profile_type text NOT NULL DEFAULT 'provider',
  card2_icon text NOT NULL DEFAULT 'Building2',
  card2_title text NOT NULL DEFAULT 'Sou Agência / RH',
  card2_description text NOT NULL DEFAULT 'Quero publicar vagas e recrutar profissionais.',
  card2_profile_type text NOT NULL DEFAULT 'rh',
  card3_icon text NOT NULL DEFAULT 'User',
  card3_title text NOT NULL DEFAULT 'Quero Contratar',
  card3_description text NOT NULL DEFAULT 'Estou procurando profissionais qualificados.',
  card3_profile_type text NOT NULL DEFAULT 'client',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_settings ENABLE ROW LEVEL SECURITY;

-- Leitura pública das configurações ativas (necessária para o modal exibir)
DROP POLICY IF EXISTS "onboarding_settings_public_read" ON public.onboarding_settings;
CREATE POLICY "onboarding_settings_public_read"
ON public.onboarding_settings
FOR SELECT
USING (active = true);

-- Apenas admins podem gerenciar
DROP POLICY IF EXISTS "onboarding_settings_admin_all" ON public.onboarding_settings;
CREATE POLICY "onboarding_settings_admin_all"
ON public.onboarding_settings
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_onboarding_settings_updated_at ON public.onboarding_settings;
CREATE TRIGGER trg_onboarding_settings_updated_at
BEFORE UPDATE ON public.onboarding_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Linha default
INSERT INTO public.onboarding_settings (active)
SELECT true
WHERE NOT EXISTS (SELECT 1 FROM public.onboarding_settings);

-- 2) Blindar trigger auto_migrate_profile_type para NUNCA alterar 'rh'
CREATE OR REPLACE FUNCTION public.auto_migrate_profile_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_count int;
  v_current_type text;
BEGIN
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);
  IF v_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT profile_type INTO v_current_type FROM public.profiles WHERE id = v_user_id;

  -- BLINDAGEM: nunca rebaixar/alterar usuários 'rh'
  IF v_current_type = 'rh' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COUNT(*) INTO v_count
    FROM public.services s
    JOIN public.providers p ON p.id = s.provider_id
   WHERE p.user_id = v_user_id
     AND s.deleted_at IS NULL;

  IF v_count > 0 AND v_current_type <> 'provider' THEN
    UPDATE public.profiles SET profile_type = 'provider', role = 'provider', updated_at = now() WHERE id = v_user_id;
  ELSIF v_count = 0 AND v_current_type = 'provider' THEN
    UPDATE public.profiles SET profile_type = 'client', role = 'client', updated_at = now() WHERE id = v_user_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;