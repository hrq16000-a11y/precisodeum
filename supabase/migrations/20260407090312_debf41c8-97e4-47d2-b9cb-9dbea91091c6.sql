
-- Create user_levels table
CREATE TABLE public.user_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#3b82f6',
  priority integer NOT NULL DEFAULT 0,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User levels viewable by everyone" ON public.user_levels FOR SELECT USING (true);
CREATE POLICY "Admins can insert user levels" ON public.user_levels FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update user levels" ON public.user_levels FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete user levels" ON public.user_levels FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Create account_types table
CREATE TABLE public.account_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#3b82f6',
  max_users integer NOT NULL DEFAULT 0,
  price numeric NOT NULL DEFAULT 0,
  resources jsonb NOT NULL DEFAULT '[]'::jsonb,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account types viewable by everyone" ON public.account_types FOR SELECT USING (true);
CREATE POLICY "Admins can insert account types" ON public.account_types FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update account types" ON public.account_types FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete account types" ON public.account_types FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Add columns to profiles
ALTER TABLE public.profiles ADD COLUMN level_id uuid REFERENCES public.user_levels(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN department text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN account_type_id uuid REFERENCES public.account_types(id) ON DELETE SET NULL;

-- Seed default levels
INSERT INTO public.user_levels (name, description, color, priority, permissions) VALUES
  ('Administrador', 'Acesso total ao sistema, pode gerenciar todos os usuários e configurações', '#ef4444', 100, '{"create_users": true, "edit_users": true, "delete_users": true, "view_users": true, "manage_settings": true, "view_reports": true, "manage_billing": true}'),
  ('Gerente', 'Pode gerenciar equipes e visualizar relatórios', '#f59e0b', 80, '{"create_users": true, "edit_users": true, "delete_users": false, "view_users": true, "manage_settings": false, "view_reports": true, "manage_billing": false}'),
  ('Supervisor', 'Pode supervisionar equipes e editar usuários', '#8b5cf6', 60, '{"create_users": false, "edit_users": true, "delete_users": false, "view_users": true, "manage_settings": false, "view_reports": true, "manage_billing": false}'),
  ('Analista', 'Acesso a relatórios e visualização de dados', '#3b82f6', 40, '{"create_users": false, "edit_users": false, "delete_users": false, "view_users": true, "manage_settings": false, "view_reports": true, "manage_billing": false}'),
  ('Usuário', 'Acesso básico ao sistema', '#6b7280', 10, '{"create_users": false, "edit_users": false, "delete_users": false, "view_users": false, "manage_settings": false, "view_reports": false, "manage_billing": false}');

-- Seed default account types
INSERT INTO public.account_types (name, description, color, max_users, price, resources, display_order) VALUES
  ('Enterprise', 'Plano empresarial completo com todos os recursos', '#ef4444', 1000, 999.90, '["API Access", "Priority Support", "Custom Integrations", "Unlimited Storage", "Advanced Analytics", "SSO"]', 1),
  ('Premium', 'Plano premium com recursos avançados', '#ec4899', 100, 299.90, '["API Access", "Priority Support", "100GB Storage", "Advanced Analytics"]', 2),
  ('Business', 'Plano ideal para pequenas empresas', '#3b82f6', 25, 89.90, '["Email Support", "50GB Storage", "Basic Collaboration"]', 3),
  ('Basic', 'Plano básico para iniciantes', '#6b7280', 5, 29.90, '["Community Support", "10GB Storage", "Basic Features"]', 4),
  ('Trial', 'Período de teste gratuito', '#10b981', 3, 0, '["Limited Access", "5GB Storage", "14 Days Trial"]', 5);
