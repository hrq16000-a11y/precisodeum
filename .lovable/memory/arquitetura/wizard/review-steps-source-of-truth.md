---
name: Review steps · fonte única
description: REVIEW_PHASE_ORDER, REVIEW_TOTAL_STEPS e PHASE_CATALOG consolidados em wizardReviewSteps.ts compartilhado entre HUD do Wizard e Dashboard Assistant.
type: feature
---

# Fonte única da régua de revisão (X/19)

Antes: `REVIEW_PHASE_ORDER` vivia em `wizardReducer.ts` e o `PHASE_CATALOG`
(com label/section dos cards) em `pages/DashboardAssistantPage.tsx`. Qualquer
divergência entre os dois passava silenciosa.

Agora: tudo vem de **`src/components/onboarding/wizard/wizardReviewSteps.ts`**:

- `REVIEW_STEP_CATALOG`: array canônico com `phase`, `title`, `description`,
  `section` (rota de edição) e flags `milestone` / `nonRenderable`.
- `REVIEW_PHASE_ORDER`: derivado do catálogo + sentinela `'done'`.
- `REVIEW_TOTAL_STEPS = 19`: constante explícita (UX histórica X/19,
  não derivada de `catalog.length` por agrupamento visual dos dois últimos
  passos).
- `isReviewPhaseRenderable`, `nextRenderableReviewPhase`,
  `prevRenderableReviewPhase`: derivados da flag `nonRenderable`.

## Consumidores

- `wizardReducer.ts` — re-exporta `REVIEW_PHASE_ORDER`, `REVIEW_TOTAL_STEPS`
  e helpers (sem redefinir).
- `WizardProgressBar.tsx` / `WizardShell.tsx` — importam do reducer
  (compat) ou do módulo canônico.
- `pages/DashboardAssistantPage.tsx` — importa `REVIEW_STEP_CATALOG`
  diretamente do módulo canônico (não tem mais array literal local).

## Anti-regressão

`src/test/wizard-review-steps-source-of-truth.test.ts` trava:
1. Reducer re-exporta as MESMAS referências do módulo canônico.
2. `REVIEW_TOTAL_STEPS === 19`.
3. `REVIEW_PHASE_ORDER` termina em `'done'`.
4. `DashboardAssistantPage.tsx` importa `REVIEW_STEP_CATALOG` e não
   redefine array literal de fases (regex bloqueia >5 entradas
   `{ phase: '...' }`).

Regra de evolução: para adicionar/remover/renomear uma fase de revisão,
**altere APENAS `wizardReviewSteps.ts`**.
