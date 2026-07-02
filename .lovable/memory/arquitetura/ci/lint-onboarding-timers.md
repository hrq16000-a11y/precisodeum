---
name: CI lint timers e listeners onboarding
description: Guardrail no GitHub Actions que bloqueia PRs com setTimeout/setInterval/addEventListener sem cleanup em arquivos do onboarding
type: feature
---

# CI Lint — Onboarding Timers/Listeners

Guardrail contínuo que falha o CI quando um arquivo do onboarding declara `setTimeout`/`setInterval`/`addEventListener` sem nenhum sinal de cleanup.

## Implementação
- Script: `scripts/lint-onboarding-timers.mjs` (Node 20, sem deps).
- Workflow: `.github/workflows/onboarding-timers-lint.yml` roda em `pull_request` e `push` para `main` quando arquivos relevantes mudam.

## Escopo
- `src/components/onboarding/**` (recursivo, ignora `__tests__` e `*.test.*`)
- `src/components/dashboard/DashboardTour.tsx`
- `src/pages/CadastroInicialPage.tsx`, `src/pages/OnboardingV2SuccessPage.tsx`

## Regra (per-occurrence, escopo léxico)
Cada `setTimeout`/`setInterval`/`.addEventListener` é avaliado individualmente. Aceita um destes sinais:
- `scheduleWizardTimeout(` (helper instrumentado).
- Cleanup pareado por nome no mesmo bloco (`const id = setTimeout(...); ... clearTimeout(id)`).
- Atribuição a `useRef.current` + `clearTimeout` em qualquer lugar do arquivo.
- Dentro de `useEffect`/`useLayoutEffect` cujo `return () => {...}` contém `clear*`/`removeEventListener`.
- **Sleep-promise** (`await new Promise((r) => setTimeout(r, ms))` — também aceita `window.setTimeout`). Cleanup mataria o await; Promise auto-resolve.
- **Cleanup-factory** — função (não-useEffect) que `return () => clearInterval(handle)` no mesmo bloco (ex.: `startTabHeartbeat`).
- `addEventListener` inline (arrow/function literal) é sempre FAIL — handler nunca pode ser removido.

## Allowlist
`ALLOW_FILES` no script. Atualmente: `BackButton.tsx` (setTimeout 600ms de lock fire-and-forget; mutação cai em ref órfão se desmontar — no-op).

## Status
- 92 arquivos varridos, todos passam.
- Smoke-test confirma detecção de violações sintéticas.
