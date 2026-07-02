
DROP POLICY IF EXISTS "system insert query_telemetry" ON public.query_telemetry;
CREATE POLICY "auth insert query_telemetry"
  ON public.query_telemetry FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
