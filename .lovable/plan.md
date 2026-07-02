# Plano de Execução — Melhorias Fantásticas

Vou executar em 6 blocos sequenciais, cada um em um PR isolado, com build verde antes de passar ao próximo. Ignoro itens já resolvidos (grants de `ibge_code`/`legal_name`, RLS de `sponsor_leads`/`realtime.messages`, `CACHE_VERSION`, guard DEV, alt/`priority`).

---

## Bloco 1 — Build & Testes 100% Verdes (P0, ~1h)

**Objetivo:** `tsgo` e Vitest limpos.

- Rodar `bun install` novamente e conferir presença real de `react-helmet-async`, `react-leaflet`, `leaflet`, `react-easy-crop`, `@dnd-kit/*`, `canvas-confetti`, `boring-avatars`, `@fingerprintjs/fingerprintjs`, `jspdf`, `jspdf-autotable`, `jszip`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`. Instalar o que faltar com `bun add` + `@types/*` correspondentes.
- Ajustar `src/test/setup.ts` para `import '@testing-library/jest-dom'` e garantir `vitest/globals` em `tsconfig.app.json` (`types` array). Isso restaura `screen`/`fireEvent`/`waitFor`.
- Adicionar mocks em `src/test/setup.ts` para libs browser-only: `canvas-confetti` (no-op), `leaflet`/`react-leaflet` (stub de componente), `jspdf` (stub construtor). Isso evita quebrar SSR/testes.
- Corrigir `integrations/lovable` removendo `'lovable'` do tipo `OAuthProvider` (ou estender união local via `type OAuthProvider = Supabase.Provider | 'lovable'`).
- Envolver imports de `canvas-confetti`, `jspdf`, `leaflet` em `dynamic import` (`await import(...)`) nos componentes que só rodam no cliente.

## Bloco 2 — TypeScript sw.ts + Workbox (P1, ~30min)

- Adicionar `tsconfig.worker.json` estendendo o principal com `"lib": ["ES2022","WebWorker"]` e `"types": ["@types/serviceworker"]`.
- Instalar `@types/serviceworker`. Tipar `self` como `ServiceWorkerGlobalScope`.
- Excluir `src/sw.ts` / `public/sw.js` do `tsconfig.app.json`.

## Bloco 3 — SEO Programático Fantástico (P0, ~3h)

**Meta: dominar "profissional em [cidade]".**

- **CategoryPage / CityPage / CategoryCityPage**: enriquecer com conteúdo único por contexto (heading H1 dinâmico, parágrafo introdutório derivado de categoria+cidade+n_providers, blocos FAQ locais via `buildLocalCategoryFaq` já existente, breadcrumbs, JSON-LD `LocalBusiness` + `ItemList` + `BreadcrumbList`).
- **Canonicals**: garantir self-reference em cada rota; remover canonicals apontando para home. Aplicar `normalizeCanonicalPath` do `seoIndexationGuard` já existente.
- **Noindex** em thin content (0 providers), filtros com `page>1`, params inválidos.
- **PopularServicePage / ServiceDetailPage / JobDetailPage**: adicionar `<Helmet>` completo — title, description, canonical self, OG `og:title`/`og:url`/`og:type=article`, `og:image` via `buildOgImage`, JSON-LD `Service`/`JobPosting`/`Product` conforme aplicável.
- **BlogPost**: JSON-LD `Article` + `BreadcrumbList` + canonical.

## Bloco 4 — Slugs Blindados no Admin (P1, ~1h)

- Criar helper `sanitizeAdminSlug()` central (kebab-case, sem acentos, sem duplo hífen, minlength 2, maxlength 80).
- Aplicar em formulários admin de: `categories`, `cities`, `services`, `institutional_pages`, `blog_posts`. Bloquear submit em slug inválido.
- Trigger PostgreSQL `enforce_slug_format()` como segunda camada.

## Bloco 5 — Rate Limit & Headers de Segurança (P1, ~1h)

- Rate-limit em edge functions públicas de métricas/RSS (`og-profile`, `sitemap`, `metrics-*`) via tabela `rate_limits` já existente (chave: IP + function_name, janela 60s).
- Criar `public/_headers` (Vercel-compatible via `vercel.json`) com CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy.
- Como projeto é Lovable Hosting: escrever `vercel.json` **e** documentar limitação em `docs/security-headers.md`.

## Bloco 6 — E2E Autenticados (P2, ~2h)

- Playwright já disponível no sandbox. Criar `e2e/` com 4 fluxos:
  - Admin: login → /admin → aprovar prestador.
  - Sponsor: login → /sponsor-panel → visualizar billing.
  - Profissional: login → /dashboard → editar serviço.
  - Cliente: login → /buscar → enviar lead.
- CI workflow `.github/workflows/e2e.yml` opcional (documentado, não bloqueante).

---

## Fora de Escopo (por decisão explícita)

- **Reduzir 568 `any` legados**: risco alto de regressão silenciosa; farei em varredura futura por arquivo, não em massa.
- **Remover `.env`/`.env_old` do histórico Git**: fora do meu alcance (git state é gerenciado). Documento em `docs/security-notes.md` e recomendo rotação manual pelo usuário via GitHub UI.
- **Migração de extensões para schema `extensions`**: alto risco em produção; requer janela de manutenção — deixo plano documentado apenas.
- **Reindexar sitemap/Google Search Console**: ação manual do usuário no GSC após deploy.

---

## Ordem de execução

Executo Bloco 1 → 2 → 3 → 4 → 5 → 6 sem pausar entre eles, salvo se `tsgo` falhar. Ao final, reporto build status, testes passando e diff de rotas SEO enriquecidas.

Confirma?
