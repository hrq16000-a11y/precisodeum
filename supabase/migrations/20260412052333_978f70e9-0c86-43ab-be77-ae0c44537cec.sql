
DROP POLICY IF EXISTS "Anyone can insert demand logs" ON public.search_demand_logs;
CREATE POLICY "Anyone can insert demand logs"
  ON public.search_demand_logs FOR INSERT
  TO public
  WITH CHECK (
    COALESCE(TRIM(query), '') <> ''
  );
