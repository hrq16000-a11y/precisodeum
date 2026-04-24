-- 1. Tabela de fontes de importação de vagas
CREATE TABLE public.job_import_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'rss' CHECK (source_type IN ('rss', 'html', 'manual')),
  feed_url TEXT,
  is_trusted BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  default_city TEXT DEFAULT '',
  default_state TEXT DEFAULT '',
  default_category_id UUID REFERENCES public.categories(id),
  default_opportunity_type TEXT NOT NULL DEFAULT 'emprego',
  notes TEXT DEFAULT '',
  last_run_at TIMESTAMPTZ,
  last_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.job_import_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage job import sources"
ON public.job_import_sources
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_job_import_sources_updated_at
BEFORE UPDATE ON public.job_import_sources
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Tabela de log de importações
CREATE TABLE public.job_import_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID REFERENCES public.job_import_sources(id) ON DELETE SET NULL,
  source_name TEXT,
  trigger_mode TEXT NOT NULL DEFAULT 'cron' CHECK (trigger_mode IN ('cron', 'manual', 'csv', 'paste')),
  found_count INTEGER NOT NULL DEFAULT 0,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.job_import_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read job import logs"
ON public.job_import_log
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert job import logs"
ON public.job_import_log
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_job_import_log_created ON public.job_import_log(created_at DESC);
CREATE INDEX idx_job_import_log_source ON public.job_import_log(source_id);

-- 3. Extensões na tabela jobs para deduplicação
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS import_source_id UUID REFERENCES public.job_import_sources(id) ON DELETE SET NULL;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_source_external_unique
  ON public.jobs(import_source_id, external_id)
  WHERE import_source_id IS NOT NULL AND external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_import_source ON public.jobs(import_source_id);