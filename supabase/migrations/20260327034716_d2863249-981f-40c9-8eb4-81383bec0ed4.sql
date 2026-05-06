
CREATE TABLE public.pwa_install_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT true,
  title text NOT NULL DEFAULT 'Instale o App',
  subtitle text NOT NULL DEFAULT 'Acesse mais rápido direto da tela inicial',
  cta_text text NOT NULL DEFAULT 'Instalar App',
  dismiss_text text NOT NULL DEFAULT 'Agora não',
  ios_instruction text NOT NULL DEFAULT 'Toque em compartilhar e depois em "Adicionar à Tela de Início"',
  show_delay_seconds integer NOT NULL DEFAULT 5,
  min_visits integer NOT NULL DEFAULT 1,
  dismiss_cooldown_days integer NOT NULL DEFAULT 7,
  max_impressions integer NOT NULL DEFAULT 0,
  show_in_footer boolean NOT NULL DEFAULT true,
  show_homepage_section boolean NOT NULL DEFAULT true,
  show_floating_banner boolean NOT NULL DEFAULT true,
  show_for_logged_in boolean NOT NULL DEFAULT true,
  show_for_visitors boolean NOT NULL DEFAULT true,
  show_on_mobile boolean NOT NULL DEFAULT true,
  show_on_desktop boolean NOT NULL DEFAULT true,
  accent_color text NOT NULL DEFAULT '#F97316',
  animation_type text NOT NULL DEFAULT 'slide-up',
  animation_duration integer NOT NULL DEFAULT 300,
  homepage_section_title text NOT NULL DEFAULT 'Tenha o app na palma da mão',
  homepage_section_subtitle text NOT NULL DEFAULT 'Instale gratuitamente e acesse profissionais, serviços e vagas com um toque.',
  homepage_section_cta text NOT NULL DEFAULT 'Instalar Agora',
  footer_cta_text text NOT NULL DEFAULT 'Instalar App',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.pwa_install_settings (id) VALUES (gen_random_uuid());

ALTER TABLE public.pwa_install_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read pwa settings"
  ON public.pwa_install_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can update pwa settings"
  ON public.pwa_install_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert pwa settings"
  ON public.pwa_install_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.pwa_install_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  source text NOT NULL DEFAULT 'banner',
  device_type text NOT NULL DEFAULT 'unknown',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pwa_install_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert pwa events"
  ON public.pwa_install_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read pwa events"
  ON public.pwa_install_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
