
-- Audit log table for tracking all admin actions
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient querying
CREATE INDEX idx_audit_log_created_at ON public.audit_log (created_at DESC);
CREATE INDEX idx_audit_log_resource ON public.audit_log (resource_type, resource_id);
CREATE INDEX idx_audit_log_user ON public.audit_log (user_id);

-- RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log"
  ON public.audit_log FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert audit log"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Add soft delete (deleted_at) to key tables
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.sponsors ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Indexes for soft delete filtering
CREATE INDEX idx_providers_deleted ON public.providers (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_jobs_deleted ON public.jobs (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_services_deleted ON public.services (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_blog_posts_deleted ON public.blog_posts (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_sponsors_deleted ON public.sponsors (deleted_at) WHERE deleted_at IS NULL;
