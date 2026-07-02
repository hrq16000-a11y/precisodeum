ALTER TABLE public.service_images
  ADD COLUMN IF NOT EXISTS is_cover boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS storage_path text;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_service_images_one_cover
  ON public.service_images(service_id)
  WHERE is_cover = true;