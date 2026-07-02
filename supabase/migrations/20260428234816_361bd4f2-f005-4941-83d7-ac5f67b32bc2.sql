-- 1) Termos proibidos adicionais (alinhados ao prompt anti-leilão)
INSERT INTO public.forbidden_service_terms (term)
VALUES
  ('preço imbatível'),
  ('preco imbativel'),
  ('imbatível'),
  ('imbativel'),
  ('cobrimos oferta'),
  ('cobrimos qualquer oferta'),
  ('preço baixo'),
  ('preco baixo'),
  ('mais barato')
ON CONFLICT (term) DO NOTHING;

-- 2) Tabela de auditoria do score de qualidade
CREATE TABLE IF NOT EXISTS public.service_quality_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL,
  provider_id UUID,
  user_id UUID,
  initial_score INTEGER,
  final_score INTEGER NOT NULL,
  forbidden_hits TEXT[] DEFAULT '{}'::TEXT[],
  category_keywords_hit TEXT[] DEFAULT '{}'::TEXT[],
  description_length INTEGER,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_quality_log_service ON public.service_quality_log(service_id);
CREATE INDEX IF NOT EXISTS idx_service_quality_log_provider ON public.service_quality_log(provider_id);
CREATE INDEX IF NOT EXISTS idx_service_quality_log_created ON public.service_quality_log(created_at DESC);

ALTER TABLE public.service_quality_log ENABLE ROW LEVEL SECURITY;

-- Prestador vê o próprio histórico
CREATE POLICY "Provider sees own quality logs"
ON public.service_quality_log
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid())
);

-- Prestador insere logs do próprio serviço
CREATE POLICY "Provider inserts own quality logs"
ON public.service_quality_log
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid())
);

-- Admins veem tudo
CREATE POLICY "Admins see all quality logs"
ON public.service_quality_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

COMMENT ON TABLE public.service_quality_log IS
  'Audit trail of ad quality score evolution. Records initial_score (first save attempt) and final_score (publication), plus forbidden term hits and category keyword matches detected.';