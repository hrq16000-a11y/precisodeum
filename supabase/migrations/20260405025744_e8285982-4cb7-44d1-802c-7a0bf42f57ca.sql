
-- Add moderation fields to reviews
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS admin_note text NOT NULL DEFAULT '';

-- Create menu_items table
CREATE TABLE public.menu_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_location text NOT NULL DEFAULT 'header',
  label text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '/',
  icon text NOT NULL DEFAULT '',
  parent_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  open_in_new_tab boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Menu items viewable by everyone"
  ON public.menu_items FOR SELECT
  TO public
  USING (active = true);

CREATE POLICY "Admins can view all menu items"
  ON public.menu_items FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert menu items"
  ON public.menu_items FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update menu items"
  ON public.menu_items FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete menu items"
  ON public.menu_items FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_menu_items_location ON public.menu_items(menu_location);
CREATE INDEX idx_menu_items_order ON public.menu_items(display_order);
