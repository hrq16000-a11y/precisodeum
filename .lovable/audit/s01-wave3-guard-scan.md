# Wave 3 · Scan categorizado (96 funções alvo)

**Data:** 2026-07-06 · **Método:** pg_proc.prosrc + pg_policies (read-only).

## Sumário

- **a_guard_interno**: 54
- **b_guard_via_rls**: 15
- **c_sem_guard**: 1
- **d_parametro_livre**: 15

> Apenas (c) e (d) exigem migration. (a) e (b) só contagem.


## c_sem_guard

### `search_sponsor_inventory(_city text, _category text, _slot text)`

```sql
SELECT *
  FROM public.get_sponsor_inventory_status() s
  WHERE
    (_slot IS NULL OR s.slot_slug = lower(trim(_slot)))
    AND (_city IS NULL OR s.city = COALESCE(public.normalize_slug(_city), '_any'))
    AND (_category IS NULL OR s.category = COALESCE(public.normalize_slug(_category), '_any'));
$function$
```


## d_parametro_livre

### `get_contact_impact_24h(_user_id uuid)`

```sql
SELECT
    COUNT(*)::bigint AS total_views,
    COUNT(*) FILTER (WHERE contact_type = 'whatsapp')::bigint AS whatsapp_clicks,
    COUNT(*) FILTER (WHERE contact_type = 'phone')::bigint AS phone_clicks,
    COUNT(DISTINCT visitor_id)::bigint AS unique_visitors
  FROM public.contact_clicks cc
  JOIN public.providers p ON p.id = cc.provider_id
  WHERE p.user_id = _user_id
    AND cc.created_at >= now() - interval '24 hours';
$function$
```

### `get_provider_activity_signals(_user_id uuid)`

```sql
DECLARE
  _working_now boolean := false;
  _active_today boolean := false;
  _last_signal_at timestamptz := NULL;
  _has_daily_post boolean := false;
  _closed_lead_24h boolean := false;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('working_now', false, 'active_today', false);
  END IF;
  BEGIN
    SELECT TRUE, MAX(last_heartbeat_at)
      INTO _working_now, _last_signal_at
      FROM public.provider_presence_sessions
     WHERE provider_id = _user_id
       AND ended_at IS NUL
```

### `get_provider_clicks_24h(_provider_id uuid)`

```sql
SELECT COUNT(*)::integer
  FROM public.lead_interactions
  WHERE provider_id = _provider_id
    AND interaction_type IN ('whatsapp', 'phone')
    AND created_at > (now() - interval '24 hours');
$function$
```

### `get_provider_daily_post(_provider_id uuid)`

```sql
SELECT
    dp.id,
    dp.image_url,
    dp.caption,
    dp.created_at,
    dp.expires_at,
    ROUND(EXTRACT(EPOCH FROM (dp.expires_at - now())) / 3600.0, 1)::numeric AS hours_remaining
  FROM public.daily_posts dp
  WHERE dp.provider_id = _provider_id
    AND dp.expires_at > now()
  ORDER BY dp.created_at DESC
  LIMIT 1;
$function$
```

### `get_provider_verification_status(_user_id uuid)`

```sql
DECLARE
  v_provider RECORD;
  v_profile RECORD;
  v_age_days INT;
  v_onb BOOLEAN;
  v_conv BOOLEAN;
BEGIN
  SELECT id, created_at, community_verified, community_verified_at
    INTO v_provider
    FROM public.providers
   WHERE user_id = _user_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, false, false, 0, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;
  SELECT onboarding_checklist_completed_at INTO v_profile
    FROM public.profiles WHERE id = _user_id;
  v_age_days := EXTRACT(DAY FR
```

### `get_sponsor_docs_status(_lead_id uuid)`

```sql
DECLARE
  v_lead record;
  v_history jsonb;
BEGIN
  IF _lead_id IS NULL THEN
    RETURN jsonb_build_object('error','missing_id');
  END IF;
  SELECT id, company_name, status, docs_status, docs_reviewed_at, docs_review_notes,
         cnpj_document_url IS NOT NULL AS has_cnpj,
         banner_url IS NOT NULL AS has_banner,
         checklist_confirmed, docs_submitted_at, created_at
  INTO v_lead
  FROM public.sponsor_leads
  WHERE id = _lead_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('
```

### `get_user_sponsor_id(_user_id uuid)`

```sql
SELECT sponsor_id FROM public.sponsor_contacts
  WHERE user_id = _user_id
  LIMIT 1
$function$
```

### `is_top_professional(_user_id uuid)`

```sql
DECLARE
  v_tier jsonb;
  v_tier_name text;
  v_answers jsonb;
  v_name_ok boolean;
  v_wa_ok boolean;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  -- Reuse maturity tier RPC if available
  BEGIN
    v_tier := public.get_user_maturity_tier(_user_id);
    v_tier_name := COALESCE(v_tier->>'tier','novato');
  EXCEPTION WHEN others THEN
    v_tier_name := 'novato';
  END;
  IF v_tier_name NOT IN ('ativo','veterano') THEN
    RETURN false;
  END IF;
  SELECT mission_answers INTO v_answers
```

### `log_sponsor_doc_validation_failure(_lead_id uuid, _doc_type text, _reason text, _metadata jsonb)`

```sql
DECLARE
  v_company text;
  v_recent_failures int;
BEGIN
  IF _lead_id IS NULL OR _doc_type NOT IN ('cnpj','banner','additional') THEN
    RETURN;
  END IF;
  SELECT company_name INTO v_company FROM public.sponsor_leads
   WHERE id = _lead_id AND created_at > now() - interval '48 hours';
  IF NOT FOUND THEN
    RETURN; -- silently drop unknown / old leads
  END IF;
  INSERT INTO public.sponsor_docs_history(lead_id, doc_type, action, status, reason, metadata)
  VALUES (_lead_id, _doc_type, 'valid
```

### `sponsor_can_create_campaign(_sponsor_id uuid)`

```sql
DECLARE
  v_max int;
  v_count int;
BEGIN
  SELECT p.max_slots INTO v_max
  FROM public.sponsor_subscriptions s
  JOIN public.sponsor_plans p ON p.id = s.plan_id
  WHERE s.sponsor_id = _sponsor_id
    AND s.status IN ('active','trialing')
  ORDER BY s.created_at DESC
  LIMIT 1;
  IF v_max IS NULL THEN RETURN false; END IF;
  IF v_max = -1 THEN RETURN true; END IF;
  SELECT COUNT(*) INTO v_count
  FROM public.sponsor_campaigns
  WHERE sponsor_id = _sponsor_id AND active = true AND deleted_at IS N
```

### `sponsor_has_active_plan(_sponsor_id uuid)`

```sql
SELECT EXISTS (
    SELECT 1
    FROM public.sponsor_subscriptions ss
    WHERE ss.sponsor_id = _sponsor_id
      AND ss.status IN ('active', 'trialing')
      AND (ss.current_period_end IS NULL OR ss.current_period_end >= now())
  );
$function$
```

### `suggest_next_contact_slot(_provider_id uuid, _from_ts timestamp with time zone)`

```sql
DECLARE
  v_hours jsonb;
  v_tz text;
  v_days jsonb;
  v_periods jsonb;
  v_local timestamptz;
  v_local_date date;
  v_local_hour int;
  v_period_order text[] := ARRAY['morning','afternoon','evening'];
  v_offset int;
  v_candidate_date date;
  v_candidate_dow int;
  v_period text;
  v_period_idx int;
  v_today_min_idx int := 0;
BEGIN
  SELECT contact_hours INTO v_hours FROM public.providers WHERE id = _provider_id;
  IF v_hours IS NULL THEN
    RETURN;
  END IF;
  v_tz := COALESCE(v_hours->>'
```

### `track_lead_interaction(_provider_id uuid, _service_id uuid, _type text, _source text, _ua_hash text)`

```sql
DECLARE
  v_id UUID;
  v_recent INT;
BEGIN
  IF _type NOT IN ('whatsapp','phone','profile','click','share') THEN
    RAISE EXCEPTION 'invalid interaction_type';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.providers WHERE id = _provider_id) THEN
    RAISE EXCEPTION 'provider not found';
  END IF;
  -- Rate-limit simples: máx 1 evento do mesmo tipo+UA+provider por minuto
  IF _ua_hash IS NOT NULL THEN
    SELECT COUNT(*) INTO v_recent
    FROM public.lead_interactions
    WHERE provider_id = _
```

### `user_lead_quota(_user_id uuid)`

```sql
DECLARE
  v_min_points integer;
BEGIN
  SELECT gl.min_points INTO v_min_points
  FROM public.profiles p
  LEFT JOIN public.gamification_levels gl ON gl.id = p.level_id
  WHERE p.id = _user_id;
  IF v_min_points IS NULL OR v_min_points < 300 THEN
    RETURN 3;          -- Iniciante (0) e Entusiasta (100)
  ELSIF v_min_points < 1500 THEN
    RETURN 10;         -- Engajado (300) e Ouro (700)
  ELSE
    RETURN NULL;       -- Platina (1500), Diamante (3000), Mestre (5000) = ilimitado
  END IF;
END;
$
```

### `user_lead_quota_usage(_user_id uuid)`

```sql
DECLARE
  v_quota integer;
  v_used  integer;
  v_provider_id uuid;
BEGIN
  SELECT id INTO v_provider_id
  FROM public.providers
  WHERE user_id = _user_id AND deleted_at IS NULL
  ORDER BY created_at ASC
  LIMIT 1;
  IF v_provider_id IS NULL THEN
    RETURN jsonb_build_object('quota', 0, 'used', 0, 'remaining', 0, 'unlimited', false);
  END IF;
  v_quota := public.user_lead_quota(_user_id);
  SELECT COUNT(*) INTO v_used
  FROM public.leads
  WHERE provider_id = v_provider_id
    AND created_at 
```


---

## Matriz função × callsite (grep em `src/` e `supabase/functions/`)

| Função | Categoria | Callsites reais | Nota |
|---|---|---|---|
| `search_sponsor_inventory` | c | apenas `types.ts` | Sem uso ativo — candidata a REVOKE `authenticated` (mantém admin/service_role). |
| `get_contact_impact_24h(_user_id)` | d | `useContactImpact.ts`, `ContactImpactWidget.tsx` | Chamada com `user.id` do próprio dono; adicionar guard `auth.uid()=_user_id`. |
| `get_provider_activity_signals(_user_id)` | d | `useProviderActivity.ts` | Público leve; considerar restringir a `authenticated` + `auth.uid()=_user_id`. |
| `get_provider_clicks_24h(_provider_id)` | d | apenas `types.ts` | Sem callsite — REVOKE `authenticated`. |
| `get_provider_daily_post(_provider_id)` | d | `DailyPostHighlight.tsx`, `DailyPostCard.tsx` | Público (perfil). **Manter `anon`** — não migrar. |
| `get_provider_verification_status(_user_id)` | d | `CommunityVerifiedStatus.tsx` | Dashboard próprio. Guard `auth.uid()=_user_id OR has_role('admin')`. |
| `get_sponsor_docs_status(_lead_id)` | d | `SponsorStatusPage.tsx` | Rota semi-pública com token; guard `is_sponsor_member` OR admin. |
| `get_user_sponsor_id(_user_id)` | d | `AdminBackupPage.tsx` | Só admin usa — guard `has_role('admin') OR auth.uid()=_user_id`. |
| `is_top_professional(_user_id)` | d | apenas `types.ts` | Sem callsite direto — REVOKE `authenticated`. |
| `log_sponsor_doc_validation_failure(_lead_id,...)` | d | `SponsorDocsUploadModal.tsx` | Guard `is_sponsor_member(_lead_id.sponsor, auth.uid())`. |
| `sponsor_can_create_campaign(_sponsor_id)` | d | apenas `types.ts` | Guard `is_sponsor_member(_sponsor_id, auth.uid())`. |
| `sponsor_has_active_plan(_sponsor_id)` | d | apenas `types.ts` | Igual acima. |
| `suggest_next_contact_slot(_provider_id, ...)` | d | `lib/contactWindow.ts` | Guard `auth.uid()=providers.user_id WHERE id=_provider_id`. |
| `track_lead_interaction(_provider_id, ...)` | d | `lib/tracking.ts` | Público — rate-limit é o único guard. Considerar manter anon (é telemetria). |
| `user_lead_quota(_user_id)` | d | apenas `types.ts` | Sem callsite front — REVOKE `authenticated`, manter admin/interno. |
| `user_lead_quota_usage(_user_id)` | d | apenas `types.ts` | Igual acima. |
| `search_sponsor_inventory(...)` | c | apenas `types.ts` | Ver acima. |

## Recomendação de priorização Wave 3

1. **Bloco alto risco (guard `auth.uid()=_user_id`)** — 5 funções:
   `get_contact_impact_24h`, `get_provider_activity_signals`, `get_provider_verification_status`, `get_user_sponsor_id`, `suggest_next_contact_slot`.
2. **Bloco sponsor (guard `is_sponsor_member`)** — 4 funções:
   `get_sponsor_docs_status`, `log_sponsor_doc_validation_failure`, `sponsor_can_create_campaign`, `sponsor_has_active_plan`.
3. **Bloco "sem callsite" (REVOKE `authenticated`, mantém admin)** — 6 funções:
   `search_sponsor_inventory`, `get_provider_clicks_24h`, `is_top_professional`, `user_lead_quota`, `user_lead_quota_usage`.
4. **Manter como está (público intencional)** — 2:
   `get_provider_daily_post` (mantém `anon`), `track_lead_interaction` (telemetria com rate-limit).

