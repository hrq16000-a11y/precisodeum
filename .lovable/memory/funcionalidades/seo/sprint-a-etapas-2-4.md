---
name: Sprint A — Etapas 2+4 (internal link tracking + funil health)
description: Sprint A pós-fix da overload — instrumentação de cliques em SeoRelatedLinks + painel /admin/funil-health.
type: feature
---

# Sprint A · Etapas 2 + 4 (concluídas)

## Etapa 2 — Internal link tracking

- `record_public_funnel_event` agora aceita `internal_link_click` na whitelist (mesma RPC, mesma assinatura, mesmo dedup server-side 10min).
- Helper `trackInternalLinkClick({ targetPath, anchorType, positionIndex, sourcePath?, category?, city? })` em `src/lib/publicFunnelTelemetry.ts`:
  - fire-and-forget (`.then(()=>{},()=>{})`), nunca bloqueia navegação;
  - dedup client-side 10min por `(source→target→anchor)` em sessionStorage;
  - mapeia `anchorType → _source = "anchor:position"` e `target_path → _resource_id` (compatível com dedup server-side existente);
  - `anchorType` enumerado: `related_category | related_city | nearby_city | neighborhood | provider | trending | urgency | faq | other`.
- `SeoRelatedLinks` instrumentado: `onClick` dispara o helper para CADA link, derivando `anchorType` de `link.group`. Aceita props opcionais `category` e `city` para enriquecer atribuição. `SeoEnhancementSection` propaga `links.categorySlug/citySlug`.
- **Escopo restrito**: apenas links renderizados pelo helper SEO. Navbar/footer/menu global NÃO são instrumentados.

## Etapa 4 — Admin health page

- Rota: `/admin/funil-health` (lazy, dentro de `AdminGuard`).
- Componente: `src/pages/admin/AdminPublicFunnelHealthPage.tsx`.
- Dados via RPC `get_public_funnel_health(_days int default 7)`:
  - `SECURITY DEFINER`, `STABLE`, `SET search_path = public`;
  - admin-only via `has_role(auth.uid(),'admin')` (failing-closed com `RAISE EXCEPTION 'forbidden'`);
  - janela 1–90 dias (default 7); clamp server-side.
- KPIs entregues: total_events, events_today, unique_paths, unique_sessions, internal_link_clicks, profile_views, lead_submits, sponsor_refs.
- Breakdowns: by_event, by_day, top_source_paths, top_target_paths, top_landings, ctr_by_landing, orphan_landings, recent_events (50).
- React Query: `staleTime: 60_000`, `refetchOnWindowFocus: false`, sem polling, sem realtime.
- `useSeoHead({ noindex: true })`.

## Não implementado nesta sprint (intencional)

- Authority Flow / ranking / score (depende de massa crítica real de `internal_link_click` em produção).
- Bot filter hardening (filtro server-side atual já bloqueia UA suspeito; whitelist já reduz volume falso).
- Testes Vitest dedicados (`internal-link-click-tracking.test.ts`, `public-funnel-health.test.ts`) — adicionar quando houver volume real para validar dedup/payload.

## Próximo passo (Etapa 5+)

Aguardar 24–48h de tráfego real e auditar via `/admin/funil-health`:
- Se `internal_link_clicks > 0` e `ctr_by_landing` mostra landings com CTR ≥ 1%, liberar Authority Flow real.
- Se landings continuam órfãs (`orphan_landings` dominante), priorizar recuperação de landings antes do ranking.
