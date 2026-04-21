-- ============================================================
-- 1) OPEN LEADS ("Pergunte e Compare" - sem leilão)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.open_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid NULL,
  client_name text NOT NULL DEFAULT '',
  client_whatsapp text NOT NULL DEFAULT '',
  service_query text NOT NULL,
  category_slug text NULL,
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_open_leads_status ON public.open_leads(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_open_leads_client ON public.open_leads(client_user_id);

ALTER TABLE public.open_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create open leads"
  ON public.open_leads FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Clients see own open leads"
  ON public.open_leads FOR SELECT
  USING (client_user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage open leads"
  ON public.open_leads FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- ============================================================
-- 2) OPEN LEAD RESPONSES (profissionais respondem "tenho disponibilidade")
-- ============================================================
CREATE TABLE IF NOT EXISTS public.open_lead_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  open_lead_id uuid NOT NULL REFERENCES public.open_leads(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL,
  provider_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'invited',
  responded_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(open_lead_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_olr_provider ON public.open_lead_responses(provider_user_id, status);
CREATE INDEX IF NOT EXISTS idx_olr_lead ON public.open_lead_responses(open_lead_id);

ALTER TABLE public.open_lead_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Provider sees own invitations"
  ON public.open_lead_responses FOR SELECT
  USING (
    provider_user_id = auth.uid()
    OR has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.open_leads ol WHERE ol.id = open_lead_id AND ol.client_user_id = auth.uid())
  );

CREATE POLICY "Provider updates own response"
  ON public.open_lead_responses FOR UPDATE
  USING (provider_user_id = auth.uid())
  WITH CHECK (provider_user_id = auth.uid());

CREATE POLICY "System inserts invitations"
  ON public.open_lead_responses FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin') OR provider_user_id = auth.uid());

-- ============================================================
-- 3) USER FAVORITES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON public.user_favorites(user_id);

ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own favorites"
  ON public.user_favorites FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 4) SEARCH INTENT LOG (para alertas FOMO "X pessoas buscaram")
-- ============================================================
CREATE TABLE IF NOT EXISTS public.search_intent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_slug text NULL,
  category_name text NULL,
  city text NULL,
  state text NULL,
  visitor_id text NULL,
  user_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_intent_recent ON public.search_intent_log(category_slug, city, created_at DESC);

ALTER TABLE public.search_intent_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log search intent"
  ON public.search_intent_log FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins read search intent"
  ON public.search_intent_log FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- ============================================================
-- 5) RPC: Distribute open lead to top-3 ranked online providers
-- ============================================================
CREATE OR REPLACE FUNCTION public.distribute_open_lead(_open_lead_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead public.open_leads;
  v_count integer := 0;
  v_provider record;
BEGIN
  SELECT * INTO v_lead FROM public.open_leads WHERE id = _open_lead_id;
  IF v_lead.id IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_provider IN
    SELECT p.id AS provider_id, p.user_id
    FROM public.providers p
    LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
    WHERE p.deleted_at IS NULL
      AND p.status = 'active'
      AND (
        v_lead.category_slug IS NULL
        OR EXISTS (
          SELECT 1 FROM public.services s
          JOIN public.categories c ON c.id = s.category_id
          WHERE s.provider_id = p.id AND c.slug = v_lead.category_slug
        )
      )
      AND (v_lead.city = '' OR LOWER(p.city) = LOWER(v_lead.city))
    ORDER BY
      COALESCE(pr.engagement_points, 0) DESC,
      COALESCE(p.rating, 0) DESC,
      COALESCE(p.review_count, 0) DESC
    LIMIT 3
  LOOP
    INSERT INTO public.open_lead_responses (open_lead_id, provider_id, provider_user_id, status)
    VALUES (_open_lead_id, v_provider.provider_id, v_provider.user_id, 'invited')
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      v_provider.user_id,
      'Nova oportunidade de atendimento',
      'Um cliente está procurando ' || COALESCE(v_lead.service_query, 'um serviço') ||
        CASE WHEN v_lead.city <> '' THEN ' em ' || v_lead.city ELSE '' END || '. Clique para responder.',
      'lead',
      '/dashboard/leads-abertos'
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ============================================================
-- 6) RPC: Get demand signals for a provider (FOMO alert)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_demand_signal(_user_id uuid)
RETURNS TABLE(category_name text, city text, search_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(sil.category_name, sil.category_slug) AS category_name,
    sil.city,
    COUNT(*)::bigint AS search_count
  FROM public.search_intent_log sil
  WHERE sil.created_at > now() - interval '24 hours'
    AND EXISTS (
      SELECT 1 FROM public.providers p
      JOIN public.services s ON s.provider_id = p.id
      JOIN public.categories c ON c.id = s.category_id
      WHERE p.user_id = _user_id
        AND c.slug = sil.category_slug
        AND (sil.city = '' OR LOWER(p.city) = LOWER(sil.city))
    )
  GROUP BY sil.category_slug, sil.category_name, sil.city
  HAVING COUNT(*) >= 3
  ORDER BY search_count DESC
  LIMIT 5;
END;
$$;