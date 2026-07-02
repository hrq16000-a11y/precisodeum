-- Table for tracking error page hits (/error/404 and /error/500)
CREATE TABLE public.error_page_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  path TEXT NOT NULL DEFAULT '',
  code INTEGER NOT NULL DEFAULT 404,
  referrer TEXT,
  user_id UUID,
  user_agent TEXT
);

-- Indexes for analytics queries
CREATE INDEX idx_error_page_events_occurred_code ON public.error_page_events (occurred_at DESC, code);
CREATE INDEX idx_error_page_events_path_code ON public.error_page_events (path, code);

-- Enable RLS
ALTER TABLE public.error_page_events ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous visitors) can insert error events
CREATE POLICY "Anyone can log error page events"
ON public.error_page_events
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only admins can read error events
CREATE POLICY "Only admins can view error page events"
ON public.error_page_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
