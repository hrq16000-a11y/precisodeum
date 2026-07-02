CREATE TABLE public.public_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_alias text NOT NULL,
  action_text text NOT NULL,
  icon text DEFAULT 'Sparkles',
  city text,
  profile_type text,
  category_name text,
  is_seed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.public_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone reads activities"
  ON public.public_activities FOR SELECT USING (true);

CREATE POLICY "authenticated inserts activities"
  ON public.public_activities FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

ALTER PUBLICATION supabase_realtime ADD TABLE public.public_activities;
ALTER TABLE public.public_activities REPLICA IDENTITY FULL;

CREATE INDEX idx_public_activities_created ON public.public_activities (created_at DESC);
CREATE INDEX idx_public_activities_seed ON public.public_activities (is_seed, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_community_feed(_limit int DEFAULT 10)
RETURNS SETOF public.public_activities
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_real int;
BEGIN
  SELECT count(*) INTO v_real FROM public.public_activities
   WHERE is_seed = false AND created_at > now() - interval '7 days';

  IF v_real >= _limit THEN
    RETURN QUERY
      SELECT * FROM public.public_activities
       WHERE is_seed = false
       ORDER BY created_at DESC
       LIMIT _limit;
  ELSE
    RETURN QUERY
      (SELECT * FROM public.public_activities
        WHERE is_seed = false
        ORDER BY created_at DESC
        LIMIT v_real)
      UNION ALL
      (SELECT * FROM public.public_activities
        WHERE is_seed = true
        ORDER BY random()
        LIMIT GREATEST(_limit - v_real, 0));
  END IF;
END $$;

INSERT INTO public.public_activities (actor_alias, action_text, icon, city, profile_type, category_name, is_seed) VALUES
  ('Mestre J.', 'acaba de se cadastrar', 'Zap', 'Curitiba', 'provider', 'Eletricista', true),
  ('Mestre R.', 'acaba de se cadastrar', 'Wrench', 'São Paulo', 'provider', 'Encanador', true),
  ('Mestre A.', 'acaba de se cadastrar', 'Paintbrush', 'Rio de Janeiro', 'provider', 'Pintor', true),
  ('Mestre P.', 'acaba de se cadastrar', 'Hammer', 'Belo Horizonte', 'provider', 'Pedreiro', true),
  ('Mestre M.', 'acaba de se cadastrar', 'Scissors', 'Salvador', 'provider', 'Cabeleireiro', true),
  ('Mestre L.', 'acaba de se cadastrar', 'Sparkles', 'Fortaleza', 'provider', 'Diarista', true),
  ('Mestre C.', 'acaba de se cadastrar', 'Car', 'Porto Alegre', 'provider', 'Mecânico', true),
  ('Mestre S.', 'acaba de se cadastrar', 'Wrench', 'Recife', 'provider', 'Encanador', true),
  ('Mestre F.', 'acaba de se cadastrar', 'Zap', 'Brasília', 'provider', 'Eletricista', true),
  ('Mestre T.', 'acaba de se cadastrar', 'Hammer', 'Manaus', 'provider', 'Marceneiro', true),
  ('Mestre B.', 'criou um novo serviço', 'Briefcase', 'Goiânia', 'provider', 'Jardineiro', true),
  ('Mestre N.', 'criou um novo serviço', 'Wrench', 'Belém', 'provider', 'Encanador', true),
  ('Mestre G.', 'criou um novo serviço', 'Paintbrush', 'Vitória', 'provider', 'Pintor', true),
  ('Mestre D.', 'criou um novo serviço', 'Hammer', 'Florianópolis', 'provider', 'Pedreiro', true),
  ('Mestre V.', 'subiu de nível', 'Trophy', 'Natal', 'provider', 'Eletricista', true),
  ('Mestre H.', 'subiu de nível', 'Trophy', 'João Pessoa', 'provider', 'Encanador', true),
  ('Empresa Construir', 'publicou uma vaga', 'Building2', 'Campinas', 'rh', 'Pedreiro', true),
  ('RH Lar Bom', 'publicou uma vaga', 'Building2', 'Santos', 'rh', 'Diarista', true),
  ('Mestre E.', 'recebeu uma avaliação 5★', 'Star', 'Maceió', 'provider', 'Pintor', true),
  ('Mestre O.', 'recebeu uma avaliação 5★', 'Star', 'Aracaju', 'provider', 'Eletricista', true),
  ('Mestre I.', 'acaba de se cadastrar', 'Truck', 'Cuiabá', 'provider', 'Frete e Mudança', true),
  ('Mestre K.', 'acaba de se cadastrar', 'Snowflake', 'Teresina', 'provider', 'Ar-condicionado', true),
  ('Mestre Q.', 'acaba de se cadastrar', 'Bug', 'Campo Grande', 'provider', 'Dedetizador', true),
  ('Mestre U.', 'acaba de se cadastrar', 'KeyRound', 'São Luís', 'provider', 'Chaveiro', true),
  ('Mestre Y.', 'acaba de se cadastrar', 'Hammer', 'Uberlândia', 'provider', 'Marceneiro', true);