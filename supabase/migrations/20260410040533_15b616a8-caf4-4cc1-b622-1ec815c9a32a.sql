
-- Global config for bottom nav bar
CREATE TABLE public.ui_bottom_nav_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active boolean NOT NULL DEFAULT true,
  layout_type text NOT NULL DEFAULT 'fixed',
  background_color text NOT NULL DEFAULT '',
  border_color text NOT NULL DEFAULT '',
  shadow boolean NOT NULL DEFAULT true,
  blur boolean NOT NULL DEFAULT true,
  height integer NOT NULL DEFAULT 64,
  padding integer NOT NULL DEFAULT 6,
  animation_type text NOT NULL DEFAULT 'spring',
  animation_duration integer NOT NULL DEFAULT 300,
  mobile_only boolean NOT NULL DEFAULT true,
  hidden_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ui_bottom_nav_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bottom nav config viewable by everyone"
ON public.ui_bottom_nav_config FOR SELECT TO public USING (true);

CREATE POLICY "Admins can manage bottom nav config"
ON public.ui_bottom_nav_config FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Individual nav items
CREATE TABLE public.ui_bottom_nav_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES public.ui_bottom_nav_config(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT 'Home',
  icon_active text NOT NULL DEFAULT '',
  route_path text NOT NULL DEFAULT '/',
  external_url text NOT NULL DEFAULT '',
  action_type text NOT NULL DEFAULT 'route',
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  badge text NOT NULL DEFAULT '',
  badge_color text NOT NULL DEFAULT '',
  text_color text NOT NULL DEFAULT '',
  active_color text NOT NULL DEFAULT '',
  background_color text NOT NULL DEFAULT '',
  border_radius text NOT NULL DEFAULT '',
  size text NOT NULL DEFAULT 'medium',
  animation text NOT NULL DEFAULT 'scale',
  requires_auth boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ui_bottom_nav_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bottom nav items viewable by everyone"
ON public.ui_bottom_nav_items FOR SELECT TO public USING (true);

CREATE POLICY "Admins can manage bottom nav items"
ON public.ui_bottom_nav_items FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Index for ordering
CREATE INDEX idx_bottom_nav_items_order ON public.ui_bottom_nav_items (config_id, order_index);
