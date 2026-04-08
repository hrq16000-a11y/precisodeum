
CREATE TABLE public.plan_resources (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  icon text NOT NULL DEFAULT '✅',
  description text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plan resources viewable by everyone"
ON public.plan_resources FOR SELECT
TO public
USING (true);

CREATE POLICY "Admins can insert plan resources"
ON public.plan_resources FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update plan resources"
ON public.plan_resources FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete plan resources"
ON public.plan_resources FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed with existing hardcoded resources
INSERT INTO public.plan_resources (name, icon, display_order) VALUES
  ('API Access', '🔌', 1),
  ('Priority Support', '⭐', 2),
  ('Email Support', '📧', 3),
  ('Community Support', '👥', 4),
  ('Custom Integrations', '🔗', 5),
  ('Unlimited Storage', '💾', 6),
  ('100GB Storage', '📦', 7),
  ('50GB Storage', '📦', 8),
  ('10GB Storage', '📦', 9),
  ('5GB Storage', '📦', 10),
  ('Advanced Analytics', '📊', 11),
  ('Basic Analytics', '📈', 12),
  ('SSO', '🔐', 13),
  ('Basic Collaboration', '🤝', 14),
  ('Basic Features', '✅', 15),
  ('Limited Access', '🔒', 16),
  ('Basic Resources', '📁', 17),
  ('14 Days Trial', '⏰', 18);
