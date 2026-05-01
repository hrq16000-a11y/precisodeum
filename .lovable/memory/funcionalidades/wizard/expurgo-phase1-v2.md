---
name: Expurgo Phase1 V2
description: Remoção definitiva das fases phase1_action/kind/location/contact (duplicadas pela triagem Bet Mode). Mai/2026.
type: feature
---
# Consolidação Bet Mode — expurgo Phase1* V2 (mai/2026)

## O que foi removido
- `src/components/onboarding/wizard/phases/v2/Phase1Basic.tsx` (4 componentes Phase1Action/Kind/Location/Contact).
- Re-exports `Step08_Action.tsx`, `Step09_Kind.tsx`, `Step10_Location.tsx`, `Step11_Contact.tsx`.
- 4 cases do `switch renderPhase()` em `OnboardingV2Shell.tsx` + back-handlers correspondentes.
- 4 entradas (`phase1_*`) de `PHASE_ORDER` em `phases/v2/state.ts`.
- Estado inicial do reducer V2 mudou: `phase: 'phase2_service'` (era `phase1_action`).

## O que foi MANTIDO (intencional)
- O TIPO `OnboardingPhase` segue listando `phase1_*` para compatibilidade com:
  - Histórico de `onboarding_events` no banco.
  - Labels em `RemoteDraftRecoveryModal.tsx` e `AdminOnboardingFunnelPage.tsx`.
  - Tags textuais em `BetModeShell` / `PhaseWho` / `PhaseProKind` (zombie guard).
  - Mappers `mapMainPhaseToUnified` / `mapUnifiedToMainPhase` em `wizardReducer.ts`.
- `bootstrap.ts::resolvePhase` agora retorna sempre `phase2_service` (a triagem garante nome/WhatsApp/cidade).
- `reviewSectionMap.identity` aponta para `phase2_service` (era `phase1_contact`).

## Por quê
Voltar do `phase2_service` em modo revisão fazia o reducer V2 cair em `phase1_location` (versão antiga e bugada do picker) — a "assombração". A triagem (Bet Mode) já cobre 100% identidade/PF-PJ/local/contato, então as 4 telas eram puro débito técnico e fonte de regressões.

## Anti-regressão
- Teste `onboarding-v3-unified-flow.test.ts` agora afirma que Step08-11 NÃO existem mais.
- Teste `onboarding-v3-first-service-regression.test.ts` afirma que `Phase1Basic.tsx` foi excluído.
- 48/48 testes do wizard passando após o expurgo.
