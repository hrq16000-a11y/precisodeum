-- Create highlights table for rotating banners on homepage
CREATE TABLE public.highlights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  link_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Highlights viewable by everyone" ON public.highlights FOR SELECT TO public USING (true);
CREATE POLICY "Admins can insert highlights" ON public.highlights FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update highlights" ON public.highlights FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete highlights" ON public.highlights FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Insert sample highlights
INSERT INTO public.highlights (title, description, image_url, link_url, display_order) VALUES
('Cadastre-se Grátis', 'Crie seu perfil profissional e comece a receber clientes hoje mesmo!', NULL, '/cadastro', 1),
('Premium Vitalício', 'Profissionais cadastrados até 2027 ganham plano Premium grátis para sempre!', NULL, '/cadastro', 2),
('Encontre Profissionais', 'Eletricistas, encanadores, pintores e muito mais na sua cidade.', NULL, '/buscar', 3);