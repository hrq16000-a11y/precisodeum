---
name: Assistente é dono do Wizard (modo revisão não-linear)
description: mode=review abre na Step 1 (triage_identity) por padrão, navega não-linear até o fim, régua única de 19 fases, hidrata triagem do banco.
type: feature
---

# Modo Assistente — Navegação Não-Linear

Mai/2026: o Wizard em `mode=review` se comporta como **editor**, não funil.

## Regras

1. **Ponto de entrada** (`WizardShell.resolveReviewStartPhase`):
   - Sem `section` ⇒ `triage_identity` (Step 1).
   - Sections novas: `identidade|quem|cidade|tipo|documento|local` → fases `triage_*`.
   - Sections clássicas (`servicos|dados|portfolio|url`) → fases `main_*` (compat).
   - `cadastro` agora também aponta para `triage_identity`.

2. **Régua única** (`REVIEW_PHASE_ORDER` em `wizardReducer.ts`): 16 fases visíveis +
   `done` cobrindo Steps 1–6 (triagem) + criação de serviço + ajustes de perfil
   + 2 extras opcionais. WizardShell passa essa régua ao `WizardProgressBar`
   sempre que `isReview`, exibindo "Etapa X/16" sem main_action..main_contact
   obsoletas.

3. **Voltar infinito**:
   - `WizardShell.handleGlobalBack` em `triage_*` ou `main_service` retrocede
     direto via `REVIEW_PHASE_ORDER` (helper local `prevReviewPhase`).
   - V2 (`OnboardingV2Shell`): pilha `reviewHistory` desempilha primeiro.
     Quando esgota, dispara `wizard:request-prev-unified` que o WizardShell
     consome retrocedendo na régua review (sem cair no Dashboard).
   - Botão Voltar nunca redireciona abruptamente para `/dashboard/assistente`.

4. **Hidratação da triagem**: novo helper `seedBetDraftFromProfile` em
   `useBetDraft.ts` pré-popula `bet_wizard_draft_v1` (não-destrutivo) com
   nome/WhatsApp/cidade/foto/documento/PF-PJ ANTES do BetModeShell montar.
   Chamado pelo bootstrap do WizardShell quando a fase resolvida começa com
   `triage_`. BetModeShell hidrata sincronamente via `loadBetDraft()` no
   initializer do useReducer — usuário vê seus dados reais já na Step 1.

## Testes

- `src/test/wizard-review-non-linear-nav.test.ts` (8): default Step 1, sections
  triage, prev linear de main_service → triage_celebration, percurso completo
  até identity.
- `src/test/wizard-review-history.test.ts` (9): pilha sessionStorage.
- `src/test/wizard-review-mode-and-skip.test.ts` (16) + `wizard-flow-e2e` (5):
  contratos preservados. 38/38 verdes.
