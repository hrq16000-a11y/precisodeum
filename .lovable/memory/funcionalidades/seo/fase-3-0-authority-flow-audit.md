---
name: SEO Authority Flow — Auditoria (Fase 3.0 · Etapa 1)
description: Auditoria read-only do fluxo de autoridade interna; bloqueia codificação até instrumentar funnel.
type: feature
---

# Fase 3.0 — Auditoria Read-Only

## TL;DR (gargalo real, baseado em evidência operacional)

**A Fase 3.0 está bloqueada por falta de sinal, não por falta de código.**

| Fonte de sinal | Linhas (90d) | Cobertura |
|---|---|---|
| `audit_log` where `resource_type='public_funnel'` | **0** | 0% — instrumentação não dispara em produção |
| `contact_clicks` | **24** | só `/profissional/*`, zero em `/categoria/*`, `/cidade/*`, `/categoria/:c/em/:cidade` |
| `web_vitals_log` | 39.368 | única fonte de telemetria com volume |

Conclusão dura: **não existe CTR interno mensurável hoje**. Construir `seoAuthorityFlow.ts`, buckets `emerging/stable/authority`, related-links "click-aware", ranking de SearchPage por authority score e dashboards de "wasted impressions" sobre esse vácuo gera **score determinístico baseado em zero** — pior que a heurística atual da 2.8/2.9, porque mascara a ausência de dado com aparência de inteligência.

## Fluxo navegacional atual (mapeado por leitura)

```
SearchPage ──► CategoryPage ──► CategoryCityPage ──► ProviderProfile ──► contato (WA/phone)
     │              │                  │                    │
     │              └──► CityPage ◄────┘                    └──► SeoEnhancementSection (FAQ + links)
     └──► /categoria/:slug · /cidade/:slug (link direto via SeoRelatedLinks)
```

- `SeoEnhancementSection` (2.9) já roda em: CategoryPage, CityPage, CategoryCityPage, ProviderProfile, CompanyProfile. **5 superfícies** cobertas, ~95% do tráfego SEO potencial.
- `seoInternalLinking.buildRelatedLinks` aplica limites duros (`MAX_TOTAL_LINKS=24`, `MAX_BLOCKS=3`, `MAX_LINK_DEPTH=4`) + filtro `thinPaths` + `internalLinkPriority` (CTR + sponsor + leads).
- `internalLinkPriority` está **pronto para receber CTR real** — assinatura aceita `{ ctr, isSponsored, leads }` — mas as páginas atuais chamam sem `signals`, então cai no baseline neutro 0.4.

## Páginas que recebem clique real (90d)

Apenas `/profissional/*`. Top 5:

| Página | Cliques WA/phone |
|---|---|
| tiago-leite-aragao-teixeira-de-freitas | 4 |
| clayton-micas-rio-de-janeiro | 2 |
| mauricio-santos-339761 | 2 |
| andre-luiz-freyer-sao-jose-dos-pinhais | 2 |
| outros 19 perfis | 1 cada |

**Zero clique** registrado em `/categoria/*` ou `/cidade/*` ou `/categoria/:slug/em/:cidade`. Possíveis causas (não exclusivas):
1. Instrumentação `contact_clicks` só dispara em CTA de perfil (correto), mas **não há equivalente para clique em link interno SEO**.
2. `trackProfileView` / `trackLeadSubmit` existem em `src/lib/publicFunnelTelemetry.ts` porém o `audit_log` está vazio para `resource_type='public_funnel'` — sugere que o RPC server-side **não está sendo chamado** ou está sendo rejeitado por RLS/bot-filter.

## Tabela problema × impacto × complexidade

| Problema | Impacto SEO | Impacto Conversão | Complexidade fix |
|---|---|---|---|
| `audit_log/public_funnel` vazio | **Crítico** — nenhuma decisão de ranking pode usar CTR | **Crítico** — buckets viram chute | Baixa (re-instrumentar 2 helpers + verificar RLS de insert) |
| Nenhum clique em link interno rastreado | Alto — impossível medir flow Search→Landing→Provider | Médio — não dá pra priorizar links que convertem | Baixa (delegar a `trackEvent('click_internal_link', …)` no `<Link>` de `SeoRelatedLinks`) |
| `internalLinkPriority` chamado sem `signals` | Médio — priorização é só baseline | Baixo | Trivial (já preparado) |
| 24 cliques de contato em 90d | — | Médio — sample insuficiente para qualquer bucket | N/A (depende de tráfego) |
| Páginas órfãs eventualmente indexadas | Médio | Baixo | Já mitigado pelo `seoIndexationGuard` |

## Top 20 rotas por potencial vs desperdício

Não computável com confiança hoje — falta a coluna de Views/CTR. O `/admin/seo-landings` consegue listar `eligible/blocked/thin/sem cliques`, mas o eixo "alta impressão, baixo CTR" requer GSC export ou o funnel instrumentado.

## Decisão recomendada (objetiva, sem teoria)

**Não fazer Etapas 2–9 agora.** Risco real de gastar 200+ linhas de código + 3 arquivos de teste para produzir um "authority engine" cuja única entrada operacional (`ctr`) é 0 em 100% das rotas.

**Sequência mínima viável (2 sprints curtos)**:

### Sprint A — Reabrir o funnel (1 PR, ~2h)
1. Auditar `src/lib/publicFunnelTelemetry.ts` (`trackProfileView`, `trackLeadSubmit`, `track_public_funnel` RPC) — confirmar que a RPC existe, tem `SECURITY DEFINER`, RLS de INSERT permite anonymous, e o bot-filter regex não está engolindo 100%.
2. Adicionar `trackInternalLinkClick({ from, to, block })` em `SeoRelatedLinks` (delegate via `onClick` do `<Link>`, fire-and-forget, dedupe 10min).
3. Adicionar `trackCategoryView` / `trackCityView` no `useEffect` de mount em CategoryPage/CityPage/CategoryCityPage (já existem helpers, basta plugar).

### Sprint B — Authority Flow REAL (Fase 3.0 redux, ~1 semana após 7d de coleta)
- Recodificar Etapas 2–9 **somente quando** `audit_log/public_funnel` tiver ≥ 500 linhas/dia E `contact_clicks` ≥ 5/dia em pelo menos 20 rotas distintas.
- Reaproveitar `internalLinkPriority` (já pronto) — apenas alimentar com `signals` reais.
- Buckets em 4 níveis (não 6): `unknown / emerging / stable / authority` — alinhado a `conversionSignals.ts` que já usa quatro buckets.
- `seoAuthorityFlow.ts` deve ser uma fina camada sobre `getProviderConversionScore` + CTR de rota, **não** um novo motor.

## Classificação atual

- SEO Runtime (2.9): **operacional** ✓
- Authority Flow (3.0): **ornamental** se executado agora — vira teatro de ranking sem dado.

## Resposta objetiva à pergunta final do briefing

> "O tráfego agora consegue circular pela plataforma ou ainda morre nas páginas de entrada?"

**Não dá para responder com evidência.** A telemetria de circulação interna não existe em produção (0 linhas em 90 dias no funnel canônico). O sintoma indireto — 100% dos cliques rastreados acontecem só no perfil, nenhum em landings SEO — sugere que o tráfego de busca **chega direto no perfil ou na busca**, e o `SeoRelatedLinks` (2.7/2.8/2.9) ainda não foi validado em produção.

## Próximo gargalo REAL (apenas evidência)

**Instrumentação do funil público.** Sem isso, qualquer Fase 3.0+ é especulação. Custo de fix: baixíssimo (1 PR cirúrgico no `publicFunnelTelemetry` + 1 evento no `SeoRelatedLinks`). Custo de não fixar: meses construindo "authority" sobre chão vazio.
