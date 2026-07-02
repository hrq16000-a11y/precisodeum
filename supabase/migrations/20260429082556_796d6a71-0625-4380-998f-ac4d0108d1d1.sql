
-- Tabela para snapshots versionados de portabilidade
CREATE TABLE IF NOT EXISTS public.portability_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'full', -- full | db | storage | code
  storage_path text NOT NULL,        -- caminho dentro do bucket portability
  size_bytes bigint NOT NULL DEFAULT 0,
  file_count integer NOT NULL DEFAULT 0,
  checksum_sha256 text,
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'ready', -- pending | ready | failed | restored
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  validated_at timestamptz
);

ALTER TABLE public.portability_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage portability snapshots" ON public.portability_snapshots;
CREATE POLICY "Admins manage portability snapshots"
ON public.portability_snapshots
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_portability_snapshots_created_at
  ON public.portability_snapshots (created_at DESC);

-- Bucket privado para snapshots e bundles
INSERT INTO storage.buckets (id, name, public)
VALUES ('portability', 'portability', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: somente admins
DROP POLICY IF EXISTS "Admins read portability bucket" ON storage.objects;
CREATE POLICY "Admins read portability bucket"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'portability' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins write portability bucket" ON storage.objects;
CREATE POLICY "Admins write portability bucket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'portability' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update portability bucket" ON storage.objects;
CREATE POLICY "Admins update portability bucket"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'portability' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins delete portability bucket" ON storage.objects;
CREATE POLICY "Admins delete portability bucket"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'portability' AND public.has_role(auth.uid(), 'admin'));
