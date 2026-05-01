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

## Regra (heurística por arquivo)
Se há `setTimeout(`, `setInterval(` ou `.addEventListener(` (fora de comentários), exige PELO MENOS UM sinal de cleanup no mesmo arquivo:
- `clearTimeout` / `clearInterval` / `removeEventListener`
- `scheduleWizardTimeout(` (helper já cleanup-friendly)
- `return () =>` (useEffect cleanup function)

## Allowlist
`ALLOW_FILES` no script — vazio por padrão. Adicionar com comentário justificando se necessário.

## Status
- 82 arquivos varridos, todos passam.
- Smoke-test confirma detecção de violações sintéticas.
