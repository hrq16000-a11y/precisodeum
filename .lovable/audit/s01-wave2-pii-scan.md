# S-01 Wave 2 · Auditoria PII do Grupo C (funções públicas para `anon`)

**Data:** 2026-07-06  
**Escopo:** 29 RPCs `SECURITY DEFINER` que devem permanecer `EXECUTE` para `anon` (páginas públicas: home, busca, perfil, categoria/cidade, rate-limit).  
**Método:** heurística sobre `pg_get_functiondef()` procurando tokens PII (`cpf|cnpj|tax_id|whatsapp|phone|email|address|full_address|birthdate|rg_number|password`) + inspeção do `RETURNS`.

## Legenda
- **clean** — nenhum token PII encontrado no corpo nem no `RETURNS`.
- **PII_SUSPECT** — o corpo/retorno contém pelo menos um token. Requer análise manual do payload retornado ao anônimo.

---

## Suspeitas (8) — análise manual necessária

| Função | RETURNS resumido | Veredito preliminar |
|---|---|---|
| `check_registration_block(_email,_whatsapp)` / `(_email,_whatsapp,_device_fingerprint)` | `jsonb` (retorna motivo do bloqueio) | **OK — não expõe PII**: `_email`/`_whatsapp` são **input** para checar duplicidade; retorno só carrega `{ blocked, matched_via }`. Confirmar que nunca ecoa o valor recebido. |
| `get_pinned_sponsor_for_search(_category_slug,_city,_state)` | inclui `whatsapp text, phone text` | **INTENCIONAL** — anúncio pago exibe WhatsApp/telefone do patrocinador ao público. Comportamento contratado. Sem ação. |
| `get_provider_clicks_24h(_provider_id)` | `integer` | **OK** — só contagem agregada. Falso positivo pelo nome do param. |
| `get_provider_conversion_stats(_provider_ids,_days)` | `whatsapp_clicks bigint, phone_clicks bigint` | **OK** — só métricas agregadas, sem valor de contato. |
| `nearby_providers(...)` | retorna `phone text, whatsapp text, street text, street_number text, complement text, postal_code text` | ⚠️ **REVISAR**: perfil exposto ao anon já mostra WhatsApp/telefone e endereço quando `show_full_address=true`. Confirmar: (a) `phone/whatsapp` só devem sair se o provider optou por exibir; (b) `street/street_number/complement/postal_code` já são filtrados quando `show_full_address=false` (regra atual). **Nada a alterar agora**, apenas documentar. |
| `register_click_lead(_provider_id,_contact_kind,_service_needed,_lead_context)` | `uuid` | **OK** — `_lead_context jsonb` é entrada; retorno só devolve id do registro. |
| `track_lead_interaction(...)` | `uuid` | **OK** — `_ua_hash` já é hash, sem PII. |

## Limpas (27)

Sem retorno de PII detectado: `check_rate_limit`, `get_active_today_providers`, `get_app_version_config`, `get_categories_with_provider_count`, `get_community_feed`, `get_featured_providers`, `get_gamification_level`, `get_geo_categories`, `get_home_bootstrap`, `get_neighborhood_by_point`, `get_provider_activity_signals`, `get_provider_daily_post`, `get_smart_ads`, `has_role`, `increment_*` (5), `is_sponsor_member`, `peek_auth_rate_limit`, `resolve_sponsor_slot_capacity`, `search_cities`, `search_cities_prioritized`, `search_sponsor_inventory`, `service_area_is_in_catalog`, `service_description_first_forbidden_term`, `sponsor_has_active_plan`.

---

## Conclusão
Nenhuma função `anon` do Grupo C precisa de sanitização imediata. Os dois casos com dados de contato (`get_pinned_sponsor_for_search`, `nearby_providers`) são **intencionais e alinhados com o modelo de negócio** (patrocinador pago + provider optando por exibir contato/endereço).

**Ação recomendada:** manter todas as 29 funções acessíveis a `anon`; nenhuma migration.
