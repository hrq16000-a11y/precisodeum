
CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  category_id uuid REFERENCES public.categories(id),
  opportunity_type text NOT NULL DEFAULT 'servico',
  description text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  neighborhood text NOT NULL DEFAULT '',
  contact_name text NOT NULL DEFAULT '',
  contact_phone text NOT NULL DEFAULT '',
  whatsapp text NOT NULL DEFAULT '',
  deadline text,
  cover_image_url text,
  status text NOT NULL DEFAULT 'active',
  slug text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Jobs viewable by everyone" ON public.jobs
  FOR SELECT TO public USING (true);

CREATE POLICY "Users can create own jobs" ON public.jobs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own jobs" ON public.jobs
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own jobs" ON public.jobs
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can update all jobs" ON public.jobs
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete all jobs" ON public.jobs
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));
