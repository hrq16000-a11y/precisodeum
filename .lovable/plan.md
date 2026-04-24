

# Análise dos 7 itens propostos

| # | Item | Status | Recomendação |
|---|---|---|---|
| 1 | `/error/500` com CTA + errorReporter | ⚠️ Parcial | Implementar só o logging |
| 2 | Métricas p95 + alertas `auth.profile_timeout` | ✅ Compatível | Implementar |
| 3 | Testes do OnboardingGate | ✅ Compatível | Implementar |
| 4 | Página `/triagem` com checklist | ❌ Já existe | Ignorar |
| 5 | Trocar atalhos do ErrorPage | ❌ Incorreto | Ignorar |
| 6 | Log de eventos /error/404 e /error/500 | ✅ Compatível | Implementar |
| 7 | Wrapper de fallback para lazy → /error/500 | ⚠️ Parcial | Implementar com cuidado |

---

## Detalhamento

### 1. `/error/500` com CTA + errorReporter — PARCIAL
A rota `/error/500`, o CTA "Buscar Profissionais" e a UI amigável **já foram implementados** no prompt anterior (`src/pages/ErrorPage.tsx` + `src/App.tsx`). O que **falta**: integrar `reportError()` do `errorReporter.ts` quando a página for acessada, capturando `path`, `referrer` e `code` (sobrepõe parcialmente com item 6 — vamos unificar).

### 2. Métricas p95 + alertas de `auth.profile_timeout` — COMPATÍVEL
Hoje o `useAuth.tsx` já dispara `reportError({ action_context: "auth.profile_timeout" })` (prompt B2). O que falta:
- Tabela `auth_performance_metrics` (ou reuso de `error_reports`) com `duration_ms` por tentativa de fetch de profile.
- Painel em `/admin/saude-sistema` (já existe `AdminSystemHealthPage.tsx`) com p50/p95/p99 e contagem de timeouts nas últimas 24h.
- Alerta visual quando `auth.profile_timeout` > 5 ocorrências/hora.

### 3. Testes do OnboardingGate — COMPATÍVEL
Criar `src/test/onboarding-gate.test.tsx` cobrindo:
- `loading=true` → renderiza skeleton, **não** redireciona
- `user && profile=null` → renderiza skeleton, **não** redireciona
- `user && profile && !profile_type` → redireciona para `/triagem`
- `user && profile && onboarding_completed=false` → redireciona
- `user && profile && completo` → renderiza children
- `user=null` → renderiza children (rotas públicas)

### 4. Página /triagem com checklist — IGNORAR
**Já existe** `src/pages/TriagePage.tsx` que monta o `SmartOnboardingWizard` (5 passos: identidade, localização+foto, contato, primeiro serviço, conclusão). Hard-gate sem botão fechar, persistência por passo, retomada via F5. Adicionar outro checklist seria duplicar fluxo.

### 5. Trocar atalhos do ErrorPage — IGNORAR (premissa incorreta)
Verifiquei `src/App.tsx` linhas 420 e 423: **as rotas `/categorias` e `/cidades` existem** (`CategoriesListPage` e `CitiesListPage`). Os links atuais estão **corretos**. Trocar por `/categoria/{slug}` exigiria slug — e usar `/buscar` em vez de `/categorias` removeria atalhos legítimos. Manter como está.

### 6. Log de eventos /error/404 e /error/500 — COMPATÍVEL
- Criar tabela `error_page_events` (`id, occurred_at, path, code, referrer, user_id nullable, user_agent`) com RLS (insert público, select admin).
- No `ErrorPage.tsx`, no `useEffect`, gravar uma linha por acesso.
- Painel admin `/admin/saude-sistema` mostrando top 20 paths com 404 nas últimas 7 dias (insumo para criar redirects ou corrigir links quebrados).

### 7. Wrapper de fallback para lazy chunks → /error/500 — PARCIAL
**Já existe** `lazyWithRetry.ts` (`importWithRetry`) que faz retry com backoff. Falta:
- Um `ErrorBoundary` específico (`LazyRouteBoundary`) envolvendo o `<Suspense>` das rotas em `App.tsx`, que captura erros de chunk-load **após** o retry esgotar e faz `Navigate` para `/error/500`.
- Não substituir o `ErrorGuard` global (que tem UX rica) — usar só para falhas de import dinâmico.
- Cuidado: o `main.tsx` já tem `tryAutomatedRecovery` para chunks. O wrapper só age **se** a recuperação automática falhar (limite 1 já configurado no prompt A3).

---

## Plano de execução (após sua autorização)

**Etapa 1 — Logging do ErrorPage (itens 1+6 unificados)**
- Migration: criar tabela `error_page_events` com RLS (insert anônimo + admin select).
- Migration: índice em `(occurred_at DESC, code)` e `(path, code)`.
- Editar `src/pages/ErrorPage.tsx`: gravar evento + chamar `reportError` para code=500.

**Etapa 2 — Métricas de auth.profile_timeout (item 2)**
- Migration: tabela `auth_profile_metrics` (`user_id, duration_ms, attempts, succeeded, recorded_at`) com RLS.
- Editar `src/hooks/useAuth.tsx`: medir tempo total + nº de tentativas e gravar em background (não bloqueia login).
- Editar `src/pages/AdminSystemHealthPage.tsx`: novo card "Performance de Auth" com p50/p95/p99 + contagem de timeouts 24h + alerta visual >5/h.

**Etapa 3 — Testes do OnboardingGate (item 3)**
- Criar `src/test/onboarding-gate.test.tsx` com os 6 cenários listados acima usando `@testing-library/react` e mock do `useAuth`.

**Etapa 4 — LazyRouteBoundary (item 7)**
- Criar `src/components/LazyRouteBoundary.tsx` (ErrorBoundary classe).
- Em `App.tsx`, envolver `<Suspense>` interno do `OnboardingGate` com esse boundary.
- Boundary detecta `ChunkLoadError` / "dynamically imported module" → redireciona para `/error/500` (não tela própria).

---

## O que será ignorado e por quê

- **Item 4 (/triagem com checklist)**: já implementado via `TriagePage` + `SmartOnboardingWizard` 5 passos.
- **Item 5 (trocar atalhos)**: rotas `/categorias` e `/cidades` existem — premissa do prompt está incorreta.

Aguardando sua autorização para iniciar pela Etapa 1.

