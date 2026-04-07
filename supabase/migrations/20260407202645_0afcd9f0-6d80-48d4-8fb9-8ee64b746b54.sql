INSERT INTO storage.buckets (id, name, public) VALUES ('sponsors', 'sponsors', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read sponsors" ON storage.objects FOR SELECT TO public USING (bucket_id = 'sponsors');
CREATE POLICY "Admin insert sponsors" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'sponsors');
CREATE POLICY "Admin update sponsors" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'sponsors');
CREATE POLICY "Admin delete sponsors" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'sponsors');