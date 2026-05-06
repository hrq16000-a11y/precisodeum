
-- Ad Slots: define positions where ads can appear
CREATE TABLE public.ad_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  page_type TEXT NOT NULL DEFAULT 'global',
  max_ads INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ad Slot Assignments: which sponsor goes in which slot
CREATE TABLE public.ad_slot_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slot_id UUID NOT NULL REFERENCES public.ad_slots(id) ON DELETE CASCADE,
  sponsor_id UUID NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  start_date DATE,
  end_date DATE,
  target_category TEXT,
  target_city TEXT,
  target_state TEXT,
  target_keywords TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(slot_id, sponsor_id)
);

-- Sponsor Metrics: detailed tracking per position/page
CREATE TABLE public.sponsor_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sponsor_id UUID NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  slot_slug TEXT NOT NULL DEFAULT 'legacy',
  event_type TEXT NOT NULL DEFAULT 'impression',
  page_path TEXT,
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast metric queries
CREATE INDEX idx_sponsor_metrics_lookup ON public.sponsor_metrics(sponsor_id, event_date, slot_slug);
CREATE INDEX idx_ad_slot_assignments_slot ON public.ad_slot_assignments(slot_id, active);

-- RLS
ALTER TABLE public.ad_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_slot_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_metrics ENABLE ROW LEVEL SECURITY;

-- ad_slots: public read, admin write
CREATE POLICY "Ad slots viewable by everyone" ON public.ad_slots FOR SELECT TO public USING (true);
CREATE POLICY "Admins can insert ad slots" ON public.ad_slots FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update ad slots" ON public.ad_slots FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete ad slots" ON public.ad_slots FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ad_slot_assignments: public read (for rendering), admin write
CREATE POLICY "Assignments viewable by everyone" ON public.ad_slot_assignments FOR SELECT TO public USING (true);
CREATE POLICY "Admins can insert assignments" ON public.ad_slot_assignments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update assignments" ON public.ad_slot_assignments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete assignments" ON public.ad_slot_assignments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- sponsor_metrics: anyone can insert (for tracking), admin can read
CREATE POLICY "Anyone can insert metrics" ON public.sponsor_metrics FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Admins can view metrics" ON public.sponsor_metrics FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Sponsors can view own metrics" ON public.sponsor_metrics FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.sponsor_contacts sc WHERE sc.sponsor_id = sponsor_metrics.sponsor_id AND sc.user_id = auth.uid())
);

-- Seed default ad slots
INSERT INTO public.ad_slots (name, slug, page_type, description, display_order) VALUES
  ('Topo Global', 'global-top', 'global', 'Banner no topo de todas as páginas', 1),
  ('Abaixo do Header', 'below-header', 'global', 'Banner logo abaixo do header', 2),
  ('Home - Entre Seções', 'home-between', 'home', 'Entre seções da homepage', 3),
  ('Home - Meio do Conteúdo', 'home-mid', 'home', 'No meio da homepage', 4),
  ('Home - Rodapé', 'home-footer', 'home', 'Acima do rodapé na homepage', 5),
  ('Vagas - Topo', 'jobs-top', 'jobs', 'Topo da página de vagas', 6),
  ('Vagas - Entre Itens', 'jobs-between', 'jobs', 'Entre listagens de vagas', 7),
  ('Vagas - Sidebar', 'jobs-sidebar', 'jobs', 'Sidebar da página de vagas', 8),
  ('Perfil - Topo', 'profile-top', 'profile', 'Topo do perfil do profissional', 9),
  ('Perfil - Após Descrição', 'profile-after-desc', 'profile', 'Após a descrição do profissional', 10),
  ('Perfil - Entre Serviços', 'profile-between-services', 'profile', 'Entre serviços listados', 11),
  ('Perfil - Antes do WhatsApp', 'profile-before-whatsapp', 'profile', 'Antes do botão de WhatsApp', 12),
  ('Perfil - Rodapé', 'profile-footer', 'profile', 'Rodapé do perfil', 13),
  ('Categorias - Topo', 'category-top', 'category', 'Topo da página de categoria', 14),
  ('Categorias - Entre Itens', 'category-between', 'category', 'Entre itens da categoria', 15),
  ('Sidebar Geral', 'sidebar', 'global', 'Sidebar lateral em páginas de conteúdo', 16),
  ('Rodapé Global', 'global-footer', 'global', 'Banner acima do rodapé global', 17);

-- Function to track metrics with upsert (aggregate by day)
CREATE OR REPLACE FUNCTION public.track_sponsor_metric(
  _sponsor_id UUID,
  _slot_slug TEXT,
  _event_type TEXT,
  _page_path TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.sponsor_metrics (sponsor_id, slot_slug, event_type, page_path, event_date, count)
  VALUES (_sponsor_id, _slot_slug, _event_type, _page_path, CURRENT_DATE, 1)
  ON CONFLICT DO NOTHING;
  
  -- Also update legacy counters
  IF _event_type = 'impression' THEN
    UPDATE public.sponsors SET impressions = impressions + 1 WHERE id = _sponsor_id;
  ELSIF _event_type = 'click' THEN
    UPDATE public.sponsors SET clicks = clicks + 1 WHERE id = _sponsor_id;
  END IF;
END;
$$;
