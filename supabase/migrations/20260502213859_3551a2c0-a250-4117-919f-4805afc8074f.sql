-- Bucket privado para anexos de relatórios de erro
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'error-attachments',
  'error-attachments',
  false,
  5242880,
  ARRAY['image/png','image/jpeg','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Usuário lê apenas seus próprios anexos
CREATE POLICY "users read own error attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'error-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Usuário insere apenas na própria pasta
CREATE POLICY "users insert own error attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'error-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Admin lê tudo (para suporte)
CREATE POLICY "admins read all error attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'error-attachments'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);
