CREATE TABLE public.category_opportunities (
  id uuid primary key default gen_random_uuid(),
  category_slug text not null unique,
  enabled boolean not null default true,
  headline text,
  subheadline text,
  body_text text,
  cta_pro_label text,
  cta_sponsor_label text,
  banner_url text,
  sponsor_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT ON public.category_opportunities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.category_opportunities TO authenticated;
GRANT ALL ON public.category_opportunities TO service_role;
ALTER TABLE public.category_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "category_opportunities_public_read" ON public.category_opportunities FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "category_opportunities_admin_write" ON public.category_opportunities FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.category_opportunity_leads (
  id uuid primary key default gen_random_uuid(),
  category_slug text not null,
  category_name text,
  kind text not null default 'professional',
  name text not null,
  email text,
  phone text,
  city text,
  message text,
  status text not null default 'new',
  source_path text,
  created_at timestamptz not null default now()
);
GRANT INSERT ON public.category_opportunity_leads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.category_opportunity_leads TO authenticated;
GRANT ALL ON public.category_opportunity_leads TO service_role;
ALTER TABLE public.category_opportunity_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "category_opportunity_leads_public_insert" ON public.category_opportunity_leads FOR INSERT TO anon, authenticated WITH CHECK (
  char_length(name) between 2 and 120
  and (email is null or char_length(email) <= 200)
  and (phone is null or char_length(phone) <= 30)
  and (message is null or char_length(message) <= 1000)
  and kind in ('professional','sponsor')
  and status = 'new'
);
CREATE POLICY "category_opportunity_leads_admin_read" ON public.category_opportunity_leads FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "category_opportunity_leads_admin_update" ON public.category_opportunity_leads FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "category_opportunity_leads_admin_delete" ON public.category_opportunity_leads FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_cat_opp_leads_created ON public.category_opportunity_leads (created_at DESC);
CREATE TRIGGER update_category_opportunities_updated_at BEFORE UPDATE ON public.category_opportunities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();