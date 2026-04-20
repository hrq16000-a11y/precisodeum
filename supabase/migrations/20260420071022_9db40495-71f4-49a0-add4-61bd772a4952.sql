
DROP FUNCTION IF EXISTS public.get_community_feed(integer);

CREATE FUNCTION public.get_community_feed(_limit int DEFAULT 10)
RETURNS TABLE (
  id uuid,
  actor_alias text,
  action_text text,
  icon text,
  city text,
  category_name text,
  profile_type text,
  is_seed boolean,
  created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_real int;
  v_hour int;
  v_business_hours boolean;
BEGIN
  v_hour := EXTRACT(HOUR FROM (now() AT TIME ZONE 'America/Sao_Paulo'))::int;
  v_business_hours := v_hour >= 8 AND v_hour < 18;

  SELECT count(*) INTO v_real
    FROM public.public_activities pa
   WHERE pa.is_seed = false
     AND pa.created_at > now() - interval '7 days';

  IF v_real >= _limit OR NOT v_business_hours THEN
    RETURN QUERY
      SELECT pa.id, pa.actor_alias, pa.action_text, pa.icon,
             pa.city, pa.category_name, pa.profile_type, pa.is_seed, pa.created_at
        FROM public.public_activities pa
       WHERE pa.is_seed = false
       ORDER BY pa.created_at DESC
       LIMIT _limit;
  ELSE
    RETURN QUERY
      (SELECT pa.id, pa.actor_alias, pa.action_text, pa.icon,
              pa.city, pa.category_name, pa.profile_type, pa.is_seed, pa.created_at
         FROM public.public_activities pa
        WHERE pa.is_seed = false
        ORDER BY pa.created_at DESC
        LIMIT v_real)
      UNION ALL
      (SELECT pa.id, pa.actor_alias, pa.action_text, pa.icon,
              pa.city, pa.category_name, pa.profile_type, pa.is_seed,
              now() - (interval '1 minute' * (5 + floor(random() * 475)::int)) AS created_at
         FROM public.public_activities pa
        WHERE pa.is_seed = true
        ORDER BY random()
        LIMIT GREATEST(0, _limit - v_real));
  END IF;
END $$;

DELETE FROM public.public_activities WHERE is_seed = true;

INSERT INTO public.public_activities (actor_alias, action_text, icon, city, category_name, profile_type, is_seed) VALUES
  ('Carlos M.', 'acaba de se cadastrar', 'Zap', 'São Paulo', 'Eletricista', 'provider', true),
  ('Ana P.', 'acaba de se cadastrar', 'Paintbrush', 'Rio de Janeiro', 'Pintora', 'provider', true),
  ('Roberto S.', 'criou um novo serviço', 'Wrench', 'Curitiba', 'Encanador', 'provider', true),
  ('Mariana L.', 'acaba de se cadastrar', 'Sparkles', 'Belo Horizonte', 'Diarista', 'provider', true),
  ('João V.', 'acaba de se cadastrar', 'Hammer', 'Porto Alegre', 'Pedreiro', 'provider', true),
  ('Patrícia R.', 'acaba de se cadastrar', 'Scissors', 'Salvador', 'Cabeleireira', 'provider', true),
  ('Eduardo F.', 'criou um novo serviço', 'Snowflake', 'Recife', 'Refrigeração', 'provider', true),
  ('Juliana M.', 'acaba de se cadastrar', 'Sparkles', 'Fortaleza', 'Diarista', 'provider', true),
  ('Marcos A.', 'acaba de se cadastrar', 'KeyRound', 'Brasília', 'Chaveiro', 'provider', true),
  ('Fernanda C.', 'criou um novo serviço', 'Paintbrush', 'Manaus', 'Pintora', 'provider', true),
  ('Bruno T.', 'acaba de se cadastrar', 'Truck', 'Goiânia', 'Frete e Mudanças', 'provider', true),
  ('Camila O.', 'acaba de se cadastrar', 'Hammer', 'Belém', 'Marceneira', 'provider', true),
  ('Ricardo H.', 'criou um novo serviço', 'Bug', 'Vitória', 'Dedetização', 'provider', true),
  ('Larissa B.', 'acaba de se cadastrar', 'Briefcase', 'Florianópolis', 'Jardineira', 'provider', true),
  ('Paulo N.', 'acaba de se cadastrar', 'Zap', 'Campinas', 'Eletricista', 'provider', true),
  ('Beatriz S.', 'criou um novo serviço', 'Sparkles', 'Natal', 'Limpeza Pós-Obra', 'provider', true),
  ('Diego L.', 'acaba de se cadastrar', 'Wrench', 'Cuiabá', 'Encanador', 'provider', true),
  ('Vanessa K.', 'acaba de se cadastrar', 'Scissors', 'João Pessoa', 'Manicure', 'provider', true),
  ('Anderson G.', 'criou um novo serviço', 'Hammer', 'Maceió', 'Pedreiro', 'provider', true),
  ('Tatiana D.', 'acaba de se cadastrar', 'Paintbrush', 'Aracaju', 'Pintora', 'provider', true),
  ('Felipe Q.', 'acaba de se cadastrar', 'Car', 'Teresina', 'Mecânico', 'provider', true),
  ('Sandra M.', 'acaba de se cadastrar', 'Sparkles', 'São Luís', 'Diarista', 'provider', true),
  ('Leandro P.', 'criou um novo serviço', 'Snowflake', 'Campo Grande', 'Ar Condicionado', 'provider', true),
  ('Renata F.', 'acaba de se cadastrar', 'Briefcase', 'Niterói', 'Jardineira', 'provider', true),
  ('Thiago R.', 'acaba de se cadastrar', 'Zap', 'Sorocaba', 'Eletricista', 'provider', true);
