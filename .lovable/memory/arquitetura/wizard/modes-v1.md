---
name: WizardMode + EditModeSkipButton v1
description: Tipo público WizardMode (new_signup/edit_profile/add_service) substitui reviewMode boolean; botão Pular esta etapa em edit_profile via evento global wizard:request-skip
type: feature
---

# WizardMode + Pular esta etapa (edit_profile)

Substitui o boolean `reviewMode` por um discriminador explícito `WizardMode` ('new_signup' | 'edit_profile' | 'add_service'), mantendo `reviewMode` como **alias deprecated** apenas para compatibilidade.

## Arquivos
- `src/components/onboarding/wizard/wizardMode.ts` — define `WizardMode`, `WizardModeContext`, `useWizardMode`, `resolveWizardMode({mode,reviewMode})` e helper `isPhaseFullyCompleted(state, phase)`.
- `src/components/onboarding/wizard/EditModeSkipButton.tsx` — botão sticky `top-16` exibido SOMENTE quando `mode==='edit_profile'` E `isPhaseFullyCompleted(state, phase)===true`. Dispara `CustomEvent('wizard:request-skip', { detail: { phase, mode } })` + telemetria `event:'skip', meta.reason:'data_already_exists'`.
- `src/components/onboarding/wizard/WizardShell.tsx` — props `mode?: WizardMode` + `reviewMode?: boolean` (deprecated). Resolve via `resolveWizardMode`. Render envolve toda a árvore num `WizardModeContext.Provider`. Renderiza `<EditModeSkipButton state={state} phase={state.phase} />` no topo.
- `src/components/onboarding/wizard/phases/v2/OnboardingV2Shell.tsx` — listener idempotente `wizard:request-skip` → `dispatch({ type: 'NEXT' })`. Cleanup via `removeEventListener` (zombie-guard compliant).
- `src/pages/CadastroInicialPage.tsx` — passa `mode={reviewMode ? 'edit_profile' : 'new_signup'}` em vez do boolean.
- `src/test/onboarding-v2-finish-flow.test.ts` — 2 testes novos validando contrato e fluxo do botão.

## Regras de visibilidade do botão "Pular esta etapa"
1. `mode === 'edit_profile'` (não aparece em `new_signup` nem `add_service`).
2. `isPhaseFullyCompleted(state, phase) === true` — TODOS os campos obrigatórios da fase já estão salvos. Fases sem obrigatórios (photos, extras_b) sempre retornam `true`. Fases sem mapeamento (celebrações, more_services) retornam `false`.

## Telemetria
Botão dispara `event:'skip'` com `meta = { variant:'unified', mode, reason:'data_already_exists', source:'edit-mode-skip-button' }` em `onboarding_events`.

## Compatibilidade retroativa
- `<WizardShell reviewMode={true} />` continua funcionando — mapeado internamente para `mode='edit_profile'`.
- Nenhum consumidor da prop `reviewMode` foi quebrado; testes existentes (12/12) verdes.
- Reducer global, gate (`resolveOnboardingGateTarget`) e finalização (`finalizeUnifiedOnboarding`) inalterados.
