-- Permite que triggers BEFORE INSERT em services registrem auditoria
-- em service_area_corrections referenciando NEW.id antes do commit da linha pai.
ALTER TABLE public.service_area_corrections
  DROP CONSTRAINT IF EXISTS service_area_corrections_service_id_fkey;

ALTER TABLE public.service_area_corrections
  ADD CONSTRAINT service_area_corrections_service_id_fkey
  FOREIGN KEY (service_id) REFERENCES public.services(id)
  ON DELETE CASCADE
  DEFERRABLE INITIALLY DEFERRED;