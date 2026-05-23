# Public Funnel — Fonte Canônica (Fase 2.2)

## Decisão

A fonte **canônica** do funil público é a tabela `audit_log` com
`resource_type = 'public_funnel'`, alimentada exclusivamente pela RPC
`record_public_funnel_event`.

Ações aceitas (whitelist):

- `public_search`  — busca executada (termo/categoria/cidade/result_count)
- `category_view`  — landing de categoria visualizada
- `city_view`      — landing de cidade visualizada
- `profile_view`   — perfil/empresa visualizado (PF e PJ)
- `lead_submit`    — lead realmente persistido (fechamento do funil)

Eventos de contato (`whatsapp_click`, `phone_click`) continuam vindos de
`log_provider_public_event` (resource_type = `provider_event`) e são
agregados pelo aggregator junto com `public_funnel`.

## Legado read-only

- `search_intent_log` — preservado **somente** para análise histórica de
  cidades/categorias (alimenta FOMO no dashboard do prestador).
  Não é mais a fonte oficial de funil público.
- `contact_clicks` — preservado para o dashboard do prestador.
  Não compõe KPIs do funil público.

## Filtros server-side

`record_public_funnel_event` aplica em ordem:

1. Whitelist de ação.
2. Filtro de bots/crawlers via header `user-agent` (regex leve).
3. Sanitização de termo (>= 8 dígitos ou `@` → descartado).
4. Deduplicação de 10 min por `(action, category, city, term, resource_id, pathname, user_id)`.

Todos os passos são **fail-soft** — observabilidade nunca quebra o app.

## Aggregator admin

`get_public_funnel_telemetry(_days)` retorna KPIs consolidados:

- volume: `searches`, `searches_today`, `zero_result_searches`,
  `profile_views`, `whatsapp_clicks`, `phone_clicks`, `leads`,
  `lead_submits`, `sponsor_clicks`.
- conversão: `ctr_search_to_view`, `ctr_view_to_contact`, `ctr_view_to_lead`.
- insights: `top_terms`, `zero_result_terms`, `top_categories`,
  `top_cities`, `top_providers`, `top_sponsors`.

Painel: `/admin/funil-publico`.
