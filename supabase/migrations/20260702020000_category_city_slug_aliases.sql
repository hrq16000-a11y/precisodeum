CREATE TABLE IF NOT EXISTS public.category_slug_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.city_slug_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_category_slug_aliases_category_id ON public.category_slug_aliases (category_id);
CREATE INDEX IF NOT EXISTS idx_city_slug_aliases_city_id ON public.city_slug_aliases (city_id);

ALTER TABLE public.category_slug_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.city_slug_aliases ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='category_slug_aliases' AND policyname='Category slug aliases are viewable by everyone'
  ) THEN
    CREATE POLICY "Category slug aliases are viewable by everyone" ON public.category_slug_aliases FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='city_slug_aliases' AND policyname='City slug aliases are viewable by everyone'
  ) THEN
    CREATE POLICY "City slug aliases are viewable by everyone" ON public.city_slug_aliases FOR SELECT USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sync_category_slug_aliases()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.slug IS NOT NULL AND OLD.slug <> '' AND OLD.slug IS DISTINCT FROM NEW.slug THEN
    INSERT INTO public.category_slug_aliases (category_id, slug)
    VALUES (NEW.id, public.sanitize_slug_text(OLD.slug))
    ON CONFLICT (slug) DO NOTHING;
  END IF;

  IF NEW.slug IS NOT NULL AND NEW.slug <> '' THEN
    INSERT INTO public.category_slug_aliases (category_id, slug)
    VALUES (NEW.id, public.sanitize_slug_text(NEW.slug))
    ON CONFLICT (slug) DO UPDATE SET category_id = EXCLUDED.category_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_category_slug_aliases ON public.categories;
CREATE TRIGGER trg_sync_category_slug_aliases
  AFTER INSERT OR UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.sync_category_slug_aliases();

CREATE OR REPLACE FUNCTION public.sync_city_slug_aliases()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.slug IS NOT NULL AND OLD.slug <> '' AND OLD.slug IS DISTINCT FROM NEW.slug THEN
    INSERT INTO public.city_slug_aliases (city_id, slug)
    VALUES (NEW.id, public.sanitize_slug_text(OLD.slug))
    ON CONFLICT (slug) DO NOTHING;
  END IF;

  IF NEW.slug IS NOT NULL AND NEW.slug <> '' THEN
    INSERT INTO public.city_slug_aliases (city_id, slug)
    VALUES (NEW.id, public.sanitize_slug_text(NEW.slug))
    ON CONFLICT (slug) DO UPDATE SET city_id = EXCLUDED.city_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_city_slug_aliases ON public.cities;
CREATE TRIGGER trg_sync_city_slug_aliases
  AFTER INSERT OR UPDATE ON public.cities
  FOR EACH ROW EXECUTE FUNCTION public.sync_city_slug_aliases();

INSERT INTO public.category_slug_aliases (category_id, slug)
SELECT id, public.sanitize_slug_text(slug)
FROM public.categories
WHERE slug IS NOT NULL AND trim(slug) <> ''
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.city_slug_aliases (city_id, slug)
SELECT id, public.sanitize_slug_text(slug)
FROM public.cities
WHERE slug IS NOT NULL AND trim(slug) <> ''
ON CONFLICT (slug) DO NOTHING;
