---
name: Histórico de navegação Wizard em revisão
description: Pilha sessionStorage que faz Voltar desempilhar fases visitadas e cair no /dashboard/assistente quando esgotada.
type: feature
---

# Wizard Review · Histórico de Navegação

`src/components/onboarding/wizard/phases/v2/reviewHistory.ts` mantém pilha
sessionStorage `onboarding_review_history_v1` (limite 32) com helpers
`pushReviewPhase`, `popReviewPhase`, `peekReviewHistory`, `clearReviewHistory`.

## Integração no `OnboardingV2Shell`

- A cada troca de `state.phase` em `editMode`: `pushReviewPhase(state.phase)`
  (idempotente — não duplica topo).
- Listener `wizard:request-back` em `editMode`: `popReviewPhase()` →
  `dispatch GO_TO` para a fase anterior REAL. Quando retorna `null`,
  `clearReviewHistory()` + `navigate('/dashboard/assistente')`.
- `useEffect([editMode])`: limpa a pilha quando o usuário sai do modo edit
  (evita vazamento entre sessões).

## Por que pilha por sessão (e não mapa estático)

Em revisão, o usuário pode pular fases via `EditModeSkipButton` ou entrar
direto em uma fase específica via `?section=` (Assistente cards). Um mapa
estático de antecessores não conhece esses pulos e prende o usuário. A pilha
reflete a navegação REAL.

## Testes

`src/test/wizard-review-history.test.ts` (9 casos): push idempotente, push
nulo/vazio ignorado, pop devolve anterior real, pop em pilha ≤1 retorna null
e limpa, clear esvazia, limite de 32, cenário Assistente→pular→Voltar.
