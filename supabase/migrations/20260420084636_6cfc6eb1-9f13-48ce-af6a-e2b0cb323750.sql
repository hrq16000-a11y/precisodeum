-- Tabela de leads/contatos liberados via WhatsApp Gate
CREATE TABLE IF NOT EXISTS public.lead_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  target_type TEXT NOT NULL DEFAULT 'provider', -- provider | sponsor | job | support
  target_id UUID,
  target_label TEXT,
  page_path TEXT,
  whatsapp_number TEXT,
  agreed_terms BOOLEAN NOT NULL DEFAULT false,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_contacts_target ON public.lead_contacts(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_lead_contacts_user ON public.lead_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_contacts_created ON public.lead_contacts(created_at DESC);

ALTER TABLE public.lead_contacts ENABLE ROW LEVEL SECURITY;

-- Admin vê tudo
CREATE POLICY "Admins can view all lead_contacts"
ON public.lead_contacts FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Usuário vê os próprios cliques
CREATE POLICY "Users can view their own lead_contacts"
ON public.lead_contacts FOR SELECT
USING (auth.uid() = user_id);

-- Profissional vê leads que receberam (target = seu provider id)
CREATE POLICY "Providers can view leads to themselves"
ON public.lead_contacts FOR SELECT
USING (
  target_type = 'provider' AND target_id IN (
    SELECT id FROM public.providers WHERE user_id = auth.uid()
  )
);

-- Qualquer autenticado pode inserir (registrando seu próprio user_id)
CREATE POLICY "Authenticated users can insert lead_contacts"
ON public.lead_contacts FOR INSERT
WITH CHECK (auth.uid() = user_id);