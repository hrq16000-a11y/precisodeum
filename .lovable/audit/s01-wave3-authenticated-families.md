# S-01 Wave 3 · Famílias de RPCs `authenticated` (255 funções)

**Data:** 2026-07-06  
**Fonte:** `pg_proc` × `has_function_privilege('authenticated', ..., 'execute')` × `prosecdef=true` no schema `public`.  
**Objetivo:** agrupar as 255 funções `SECURITY DEFINER` chamáveis por qualquer sessão autenticada e sinalizar quais precisam de **guard adicional de perfil** (`has_role`, `is_sponsor_member`, `auth.uid()=owner`) antes de Wave 3.

## Distribuição por família

| Família | Qtd | Guard esperado antes de Wave 3 |
|---|---:|---|
| **admin** | 75 | `IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;` |
| **sponsor** | 36 | `is_sponsor_member(_sponsor_id, auth.uid())` OR `has_role('admin')` |
| **provider** | 23 | `auth.uid() = provider.user_id` (evitar leitura cruzada) |
| **client_lead** | 11 | `auth.uid() = lead.client_id` OR provider dono OR admin |
| **onboarding** | 9 | `auth.uid() = _user_id` (anti privilégio horizontal) |
| **gamification** | 17 | `auth.uid() = _user_id` para leitura/mutação de pontos |
| **governance_audit** | 12 | `has_role('admin')` — nenhuma exceção |
| **notifications** | 2 | `auth.uid() = notification.user_id` |
| **rh_jobs** | 2 | dono da vaga OR admin |
| **media_portfolio** | 4 | dono do álbum/foto OR admin |
| **reviews** | 1 | autor OR provider revisado OR admin |
| **billing** | 1 | sponsor dono OR admin |
| **lgpd_privacy** | 4 | `auth.uid() = _user_id` obrigatório |
| **geo** | 4 | público OK, mas verificar rate-limit por sessão |
| **other** (reclassificar) | 54 | ver tabela abaixo |

Total: **255**

## Famílias que exigem checagem prioritária em Wave 3

1. **admin (75)** — risco máximo. Auditoria manual 1-a-1 para garantir `has_role('admin')` no topo. Muitas ainda dependem só do `REVOKE` externo.
2. **sponsor (36)** — risco de vazamento entre patrocinadores. Confirmar `is_sponsor_member`.
3. **onboarding (9)** + **gamification (17)** — risco horizontal (usuário A lendo/mutando estado de usuário B).
4. **client_lead (11)** — leads são dado sensível; validar ownership.
5. **lgpd_privacy (4)** — `delete_account`, `export_data`, `mark_consent_*`. Guard `auth.uid()=_user_id` é OBRIGATÓRIO.

## Reclassificação do bucket `other` (54)

| Função | Família sugerida | Guard sugerido |
|---|---|---|
| `check_and_log_whatsapp_click` | provider/gamification | dono do clique (auth.uid()) |
| `check_rate_limit` / `peek_auth_rate_limit` | infra | manter — só telemetria |
| `check_registration_block` (2 sigs) | auth infra | manter público |
| `close_presence_session` / `track_presence_heartbeat` | provider | auth.uid()=owner |
| `create_daily_post` / `delete_daily_post` | provider | auth.uid()=owner |
| `create_service_atomic` / `update_service_atomic` | provider | auth.uid()=provider.user_id |
| `dismiss_dashboard_widget` / `restore_dashboard_widget` / `register_dashboard_visit` / `record_dashboard_session` | client dashboard | auth.uid()=_user_id |
| `get_app_version_config` / `get_home_bootstrap` / `get_smart_ads` / `get_community_feed` | público | manter |
| `get_contact_impact_24h` / `get_missed_opportunities` / `get_whatsapp_clicks_today` / `list_whatsapp_contacts_history` | provider | auth.uid()=provider.user_id |
| `get_demand_signal` / `get_search_demand_stats` / `log_search_intent` | telemetria/SEO | manter authenticated |
| `get_latest_user_access_logs` | lgpd | auth.uid()=_user_id |
| `get_my_profile_status` / `get_profile_completeness` / `get_user_maturity_tier` / `get_weekly_summary` | user | auth.uid()=_user_id |
| `get_profile_tax_id` / `set_profile_tax_id` | lgpd | auth.uid()=_user_id **crítico** |
| `get_user_storage_usage` | user | auth.uid()=_user_id |
| `get_web_vitals_weekly_summary` / `log_web_vitals` / `log_error_page_event` / `log_exit_intent_event` / `log_pwa_install_event` | telemetria | manter authenticated |
| `increment_highlight_clicks` / `increment_service_view` | contadores públicos | manter |
| `is_caller_admin` | admin helper | manter (só retorna bool) |
| `is_top_professional` | provider | manter |
| `log_contact_click` | telemetria | manter |
| `realign_first_service` | provider | auth.uid()=owner |
| `record_public_funnel_event` | telemetria pública | manter |
| `register_service_completion` | provider | auth.uid()=provider.user_id |
| `request_self_account_ban` | lgpd | auth.uid()=_user_id |
| `resolve_identity_suggestion` | provider | auth.uid()=owner |
| `search_cities` / `search_cities_prioritized` | público | manter |
| `service_description_first_forbidden_term` | infra | manter |
| `suggest_next_contact_slot` | provider | auth.uid()=owner |
| `upload_failure_stats` | telemetria upload | manter |

## Matriz função×callsite (indeterminadas do Wave 2, confirmadas)

| Função | Callsite | Frequência | Recomendação Wave 3 |
|---|---|---|---|
| `get_provider_activity_signals` | `src/hooks/useProviderActivity.ts:27` | provider dashboard | manter authenticated + guard `auth.uid()=_user_id OR provider follows _user_id`. |
| `register_click_lead` | `src/pages/provider-profile/sections/ServicesSection.tsx:81`, `src/pages/ProviderProfile.tsx:131` | perfil público | **manter anon** — usado por visitante. |
| `get_provider_daily_post` | `DailyPostCard.tsx:45`, `DailyPostHighlight.tsx:29` | perfil público | **manter anon**. |
| `user_lead_quota` / `user_lead_quota_usage` | sem callsite front | admin/interno | adicionar guard admin + revoke anon (Wave 3 bloco guards). |
| `generate_referral_code` | sem callsite direto (referral fluxo dashboard) | authenticated | guard `auth.uid()=_user_id`. |
| `get_user_sponsor_id` | sem callsite direto | sponsor helper | guard `auth.uid()=_user_id`. |
| `get_weekly_summary` | dashboard | authenticated | guard `auth.uid()=_user_id`. |
| `is_sponsor` | RLS/helper | manter | usada em policies. |
| `sponsor_can_create_campaign` | sponsor dashboard | authenticated | guard `is_sponsor_member`. |
| `suggest_next_contact_slot` | provider dashboard | authenticated | guard `auth.uid()=provider.user_id`. |

## Checklist de smoke tests pós-migration (a rodar quando Wave 2/3 for aplicado)

1. **Anônimo — home & busca:**
   - `GET /` renderiza sem erro (usa `get_home_bootstrap`, `get_featured_providers`, `get_smart_ads`).
   - `/buscar?categoria=eletricista` retorna lista (`nearby_providers`, `search_cities_prioritized`).
   - `/categoria/:slug` e `/categoria/:slug/em/:cidade` OK.
2. **Anônimo — perfil público:**
   - Abrir 1 perfil de provider: WhatsApp/telefone visíveis conforme `show_full_address`.
   - Clique WhatsApp/telefone dispara `register_click_lead` (200).
   - `DailyPostHighlight` carrega (`get_provider_daily_post`).
3. **Autenticado — dashboard provider:**
   - `/dashboard` sem erros de RPC.
   - Storage quota mostra número (`get_user_storage_usage`).
   - Leads listam autor no histórico (`get_lead_history_authors`).
4. **Autenticado — patrocinador:**
   - `/sponsor-panel` sem 401/403.
   - Upload de doc dispara `log_sponsor_doc_validation_failure` em caso de rejeição.
5. **Admin:**
   - `/admin` acessa (`has_role`).
   - `AdminAuditRefPage` executa `audit_user_ref_full` (sem regressão).
6. **Auth infra:**
   - Login/signup dispara `check_rate_limit`, `check_registration_block`, `peek_auth_rate_limit`.
7. **Linter Supabase:** rodar `supabase--linter` e comparar `0028/0029` com o baseline atual (55 anon / 255 authenticated).
