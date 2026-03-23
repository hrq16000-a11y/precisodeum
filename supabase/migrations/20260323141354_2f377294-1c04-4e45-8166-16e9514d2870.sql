
-- ============================================================
-- FASE 1 — CRM PATROCINADORES: TABELAS + RLS
-- ============================================================

-- 1. sponsor_contacts: vincula um user a um sponsor
CREATE TABLE public.sponsor_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  company_name text NOT NULL DEFAULT '',
  contact_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  role text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, sponsor_id)
);

ALTER TABLE public.sponsor_contacts ENABLE ROW LEVEL SECURITY;

-- Sponsor can see own contact record
CREATE POLICY "Sponsor can view own contact"
  ON public.sponsor_contacts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admin can view all contacts
CREATE POLICY "Admins can view all sponsor contacts"
  ON public.sponsor_contacts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admin can insert
CREATE POLICY "Admins can insert sponsor contacts"
  ON public.sponsor_contacts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin can update
CREATE POLICY "Admins can update sponsor contacts"
  ON public.sponsor_contacts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin can delete
CREATE POLICY "Admins can delete sponsor contacts"
  ON public.sponsor_contacts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Sponsor can update own contact
CREATE POLICY "Sponsor can update own contact"
  ON public.sponsor_contacts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. sponsor_campaigns: campanhas vinculadas a sponsors
CREATE TABLE public.sponsor_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  start_date date,
  end_date date,
  budget numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sponsor_campaigns ENABLE ROW LEVEL SECURITY;

-- Sponsor can view own campaigns
CREATE POLICY "Sponsor can view own campaigns"
  ON public.sponsor_campaigns FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sponsor_contacts sc
    WHERE sc.sponsor_id = sponsor_campaigns.sponsor_id AND sc.user_id = auth.uid()
  ));

-- Admin full access
CREATE POLICY "Admins can select sponsor campaigns"
  ON public.sponsor_campaigns FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert sponsor campaigns"
  ON public.sponsor_campaigns FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update sponsor campaigns"
  ON public.sponsor_campaigns FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete sponsor campaigns"
  ON public.sponsor_campaigns FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. sponsor_contracts: contratos
CREATE TABLE public.sponsor_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  contract_number text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  start_date date,
  end_date date,
  value numeric DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sponsor_contracts ENABLE ROW LEVEL SECURITY;

-- Sponsor can view own contracts
CREATE POLICY "Sponsor can view own contracts"
  ON public.sponsor_contracts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sponsor_contacts sc
    WHERE sc.sponsor_id = sponsor_contracts.sponsor_id AND sc.user_id = auth.uid()
  ));

-- Admin full access
CREATE POLICY "Admins can select sponsor contracts"
  ON public.sponsor_contracts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert sponsor contracts"
  ON public.sponsor_contracts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update sponsor contracts"
  ON public.sponsor_contracts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete sponsor contracts"
  ON public.sponsor_contracts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. sponsor_notes: anotações internas
CREATE TABLE public.sponsor_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sponsor_notes ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins can select sponsor notes"
  ON public.sponsor_notes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert sponsor notes"
  ON public.sponsor_notes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete sponsor notes"
  ON public.sponsor_notes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. sponsor_notifications: notificações para patrocinadores
CREATE TABLE public.sponsor_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sponsor_notifications ENABLE ROW LEVEL SECURITY;

-- Sponsor can view own notifications
CREATE POLICY "Sponsor can view own notifications"
  ON public.sponsor_notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Sponsor can mark own notifications as read
CREATE POLICY "Sponsor can update own notifications"
  ON public.sponsor_notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin full access
CREATE POLICY "Admins can select sponsor notifications"
  ON public.sponsor_notifications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert sponsor notifications"
  ON public.sponsor_notifications FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete sponsor notifications"
  ON public.sponsor_notifications FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 6. Security definer function to check if user is a sponsor
CREATE OR REPLACE FUNCTION public.is_sponsor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sponsor_contacts
    WHERE user_id = _user_id
  )
$$;

-- 7. Security definer function to get sponsor_id for a user
CREATE OR REPLACE FUNCTION public.get_user_sponsor_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sponsor_id FROM public.sponsor_contacts
  WHERE user_id = _user_id
  LIMIT 1
$$;
