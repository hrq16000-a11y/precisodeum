CREATE TABLE public.sponsor_leads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name text NOT NULL,
  cnpj text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  plan text NOT NULL DEFAULT 'basic',
  contract_accepted boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'new',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sponsor_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit sponsor lead"
  ON public.sponsor_leads FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Admins can view sponsor leads"
  ON public.sponsor_leads FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update sponsor leads"
  ON public.sponsor_leads FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete sponsor leads"
  ON public.sponsor_leads FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));