
CREATE TABLE public.profile_type_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'client',
  icon text NOT NULL DEFAULT '👤',
  color text NOT NULL DEFAULT '#3b82f6',
  tier_key text NOT NULL DEFAULT '',
  default_level_id uuid REFERENCES public.user_levels(id) ON DELETE SET NULL,
  default_account_type_id uuid REFERENCES public.account_types(id) ON DELETE SET NULL,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_type_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profile type settings viewable by everyone"
ON public.profile_type_settings FOR SELECT TO public USING (true);

CREATE POLICY "Admins can insert profile type settings"
ON public.profile_type_settings FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update profile type settings"
ON public.profile_type_settings FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete profile type settings"
ON public.profile_type_settings FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed with the 3 existing profile types
INSERT INTO public.profile_type_settings (profile_key, label, description, role, icon, color, tier_key, default_level_id, default_account_type_id, capabilities, display_order) VALUES
(
  'client',
  'Cliente',
  'Busca profissionais, solicita orçamentos. NÃO publica serviços nem vagas.',
  'client',
  '👤',
  '#3b82f6',
  'free_client',
  '716c417b-fdc8-4121-879b-abcd8f0a216f',
  '50a97ea2-c43e-472f-b6f2-4dd180379cad',
  '[{"label":"Buscar profissionais","enabled":true},{"label":"Solicitar orçamentos","enabled":true},{"label":"Ver perfis e avaliações","enabled":true},{"label":"Avaliar profissionais","enabled":true},{"label":"Cadastrar serviços","enabled":false},{"label":"Receber leads","enabled":false},{"label":"Publicar vagas","enabled":false},{"label":"Página profissional","enabled":false}]'::jsonb,
  1
),
(
  'provider',
  'Profissional',
  'Página profissional, cadastra serviços, recebe leads e publica vagas.',
  'provider',
  '🔧',
  '#10b981',
  'free_provider',
  '716c417b-fdc8-4121-879b-abcd8f0a216f',
  '50a97ea2-c43e-472f-b6f2-4dd180379cad',
  '[{"label":"Página profissional","enabled":true},{"label":"Cadastrar serviços","enabled":true},{"label":"Receber leads","enabled":true},{"label":"Publicar vagas","enabled":true},{"label":"Portfólio de trabalhos","enabled":true},{"label":"Aparecer nas buscas","enabled":true},{"label":"Estatísticas de perfil","enabled":true},{"label":"Personalizar página","enabled":true}]'::jsonb,
  2
),
(
  'rh',
  'Agência / RH',
  'Publica vagas, recruta profissionais. NÃO cadastra serviços.',
  'client',
  '🏢',
  '#8b5cf6',
  'free_rh',
  '716c417b-fdc8-4121-879b-abcd8f0a216f',
  '50a97ea2-c43e-472f-b6f2-4dd180379cad',
  '[{"label":"Publicar vagas","enabled":true},{"label":"Recrutar profissionais","enabled":true},{"label":"Buscar profissionais","enabled":true},{"label":"Gerenciar candidatos","enabled":true},{"label":"Cadastrar serviços","enabled":false},{"label":"Receber leads","enabled":false},{"label":"Página profissional","enabled":false},{"label":"Aparecer nas buscas","enabled":false}]'::jsonb,
  3
);
