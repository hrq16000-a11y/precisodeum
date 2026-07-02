## Plano — 5 frentes de escala/SEO/perf

Cada frente é independente e pode ser feita em PR separado. A ordem sugerida abaixo coloca primeiro o que tem maior ROI com menor risco de quebra. Marque quais você quer que eu execute (todas, algumas, ou em qual ordem).

---

### 1. Pré-render das top 50 landings (SEO + TTFB)

**Realidade do stack:** este é um SPA Vite puro — não há SSR. Soluções viáveis sem trocar de framework:

- **Opção A (recomendada):** `vite-plugin-prerender` ou `react-snap` no build. Roda um headless Chrome no `vite build`, gera HTML estático para cada rota da lista. Custo: +2–4 min no build, zero impacto em runtime.
- **Opção B:** Edge function `prerender-landing` que serve HTML pré-renderizado quando o `User-Agent` for crawler (Googlebot/Bingbot/Facebook/etc), passthrough para SPA caso contrário. Mais complexo, mas atualiza sem rebuild.

**Escopo:**
- Lista das top 50 vem de RPC: top 25 `/categoria/:slug/em/:cidade` por tráfego em `audit_log` (últimos 30d) + 25 `/categoria/:slug` mais visitadas. Fallback: top categorias × top cidades por contagem de providers.
- Gera HTML com `<title>`, `<meta>`, JSON-LD e o **conteúdo crítico** (H1, lista de providers, links internos) já no markup — sem esperar JS. SPA continua hidratando por cima.
- Sitemap.xml continua refletindo todas as URLs (não só as pré-renderizadas).

**Risco:** baixo na Opção A (só afeta build). Médio na B (mais um ponto de cache para invalidar).

**Recomendação:** Opção A. Decidir entre `react-snap` (mais maduro) e `vite-plugin-prerender` (mais ativo).

---

### 2. `pg_stat_statements` + painel admin de queries lentas

**Passos:**
1. Migration: `CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;` (já vem habilitado em projetos Supabase recentes — apenas confirmar).
2. RPC `admin_top_slow_queries(_limit int, _min_calls int)` SECURITY DEFINER + check `has_role(auth.uid(),'admin')`, lê `extensions.pg_stat_statements` agregando `mean_exec_time`, `calls`, `total_exec_time`, `rows`. Retorna 50 piores.
3. RPC `admin_top_io_queries` (similar, ordena por `shared_blks_read + shared_blks_hit`).
4. RPC `admin_reset_stat_statements` (só admin) com botão na UI.
5. Página `/admin/db-perf` com 3 abas: **Lentas**, **Mais chamadas**, **Mais I/O**. Cards com mean_ms, p95, calls, rows/call, query truncado + tooltip. Botão "Resetar contadores".
6. Bonus: cron diário grava snapshot em `db_perf_snapshots` (tabela já existe, 0 rows hoje) para histórico semanal.

**Risco:** zero. Tudo read-only, admin-only.

---

### 3. Amostragem + TTL nas tabelas de telemetria

**Tabelas alvo** (ordem de peso atual):

| Tabela | Tamanho | TTL sugerido | Amostragem |
|---|---|---|---|
| `web_vitals_log` | 17 MB | 7 dias detalhado + agregação semanal | 10% em prod |
| `sponsor_metrics` | 9.4 MB | 90 dias detalhado | — |
| `auth_profile_metrics` | 6.9 MB | 30 dias | — |
| `rls_policy_snapshots` | 6.5 MB | 14 dias | — |
| `query_telemetry` | 5.5 MB | 7 dias + agregação | 5% em prod |
| `performance_reports` | 5 MB | 30 dias | — |
| `user_access_logs` | 2 MB | 90 dias (LGPD) | — |
| `health_check_history` | 1.2 MB | 14 dias | — |
| `error_page_events` | 1 MB | 30 dias | — |

**Implementação:**
- Migration cria função `purge_telemetry_tables()` que roda `DELETE` parametrizado por tabela e idade.
- Cron diário (03:00 BRT) invoca a função.
- Amostragem feita no client: helper `shouldSampleTelemetry(rate)` lendo `site_settings.telemetry_sample_rate_*` para controle remoto sem deploy.
- View materializada `web_vitals_weekly_summary` (média + p75 + p95 por rota/dia) para preservar histórico agregado antes do delete.

**Risco:** baixo. TTL é DELETE puro, fácil de auditar. Amostragem é opt-in por chave.

---

### 4. CLS 0.136 na landing — diagnóstico + correção

**Plano de diagnóstico:**
1. Rodar `browser--performance_profile` na home pra confirmar elementos com layout shift.
2. Suspeitos prováveis (sem ver ainda): banners de hero rotativo, cards de prestadores carregando avatares sem `width/height`, AdBanner slots, sponsor cards (lazy + reflow).

**Correções padronizadas:**
- Toda `<img>` ganha `width` + `height` (ou `aspect-ratio` no CSS).
- Cards de provider/sponsor com `min-height` definido para evitar reflow ao popular.
- Hero rotator com altura fixa (já tem? confirmar).
- AdBanner slots com placeholder de mesma altura do anúncio.
- `font-display: swap` confirmado (`docs/auth-password-rules.md` cita FOIT — verificar).

Após patch, rodar profile de novo e confirmar CLS < 0.05.

**Risco:** baixo, só CSS/markup.

---

### 5. OG tags dinâmico para categoria/cidade/profissional

**Estado atual:**
- Edge function `og-profile` já existe e gera OG image dinâmica para `/profissional/:slug` com variants 1200x630 (Facebook/Twitter) e 1080x1080 (WhatsApp/LinkedIn) via UA-detect.
- Categoria/cidade **não** têm OG image dinâmica.
- `react-helmet-async` já está no projeto; algumas páginas usam, outras não.

**Escopo:**
1. Nova edge function `og-category` → renderiza SVG → PNG via `@vercel/og` ou similar. Inputs: `?slug=encanador`. Output: imagem com ícone Lucide + nome categoria + brand.
2. Nova edge function `og-category-city` → `?categoria=...&cidade=...`. Mesma estrutura + contagem de profissionais ativos (cache 1h).
3. `useDynamicOg(route)` hook que monta `<meta property="og:image">` com URL da edge function correta + `og:title`, `og:description`, `twitter:card` para cada tipo de página.
4. Integrar em `CategoryPage`, `CityPage`, `CategoryCityPage`, `ProviderProfile` (este último já tem — só verificar).
5. Crawler social NÃO executa JS — solução: as edge functions de OG retornam imagens; as **meta tags em si** dependem da Opção A do item 1 (pré-render) para crawlers verem o markup. **Sem pré-render, só Googlebot vê — Facebook/LinkedIn/WhatsApp não.** Por isso o item 5 só fica 100% funcional se o item 1 também for executado.

**Risco:** baixo. Falha-soft: se OG image falhar, social cai no fallback estático em `index.html`.

---

## Resumo de dependências

```text
1 (pré-render)  ──┬─→  5 (OG meta tags visíveis para crawlers)
                  │
2 (pg_stat)    ──┘   (independente)
3 (TTL)              (independente)
4 (CLS)              (independente)
```

**Ordem sugerida de execução:**
1. CLS (1h, ganho imediato em Web Vitals)
2. TTL telemetria (2h, economia operacional contínua)
3. pg_stat_statements + painel (3h, visibilidade que destrava decisões futuras)
4. Pré-render top 50 (4–6h, ganho de SEO/TTFB)
5. OG dinâmico categoria/cidade (3h, depende do item 4 para crawlers não-Google)

**Total estimado:** ~15h de trabalho focado, distribuível em 5 PRs.

Me diga **quais frentes você quer que eu execute agora** (todas, algumas, em qual ordem) e eu sigo. Se quiser todas, eu começo pela ordem sugerida.