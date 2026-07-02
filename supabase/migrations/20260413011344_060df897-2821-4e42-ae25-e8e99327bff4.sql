
-- Error reports table
CREATE TABLE public.error_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  page_path TEXT NOT NULL DEFAULT '',
  action_context TEXT NOT NULL DEFAULT '',
  error_message TEXT NOT NULL DEFAULT '',
  error_stack TEXT,
  component_name TEXT,
  user_agent TEXT,
  viewport TEXT,
  action_history JSONB DEFAULT '[]',
  screenshot_url TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  admin_notes TEXT,
  severity TEXT NOT NULL DEFAULT 'error',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.error_reports ENABLE ROW LEVEL SECURITY;

-- Users can insert their own error reports
CREATE POLICY "Users can report errors"
  ON public.error_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can see their own reports
CREATE POLICY "Users can view own reports"
  ON public.error_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can see all
CREATE POLICY "Admins can view all reports"
  ON public.error_reports FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update
CREATE POLICY "Admins can update reports"
  ON public.error_reports FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Index for admin dashboard
CREATE INDEX idx_error_reports_unresolved ON public.error_reports (resolved, created_at DESC);
CREATE INDEX idx_error_reports_user ON public.error_reports (user_id, created_at DESC);
