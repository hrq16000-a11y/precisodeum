# Wizard · Régua de Revisão (X/19) — Guia Interno

> **Fonte ÚNICA da verdade**: `src/components/onboarding/wizard/wizardReviewSteps.ts`
> **Hooks de UI**: `useReviewAnchor.ts` · `useReviewPhasePersistence.ts`
> **Componente**: `WizardProgressBar.tsx`
> **Fachada pública**: `WizardShell.tsx`

Este documento existe para evitar que qualquer mudança futura quebre a
**paridade de numerador** entre o Wizard (`/cadastro-inicial?mode=review`)
e o Dashboard Assistant (`/dashboard/assistente`). Ambos exibem
**"Etapa X/19"** e ambos derivam dessa mesma régua.

---

## 1. Conceitos

### 1.1 `REVIEW_STEP_CATALOG`
Array ordenado das **19 etapas oficiais da revisão**. Cada item tem:

| Campo            | Tipo       | Significado                                                        |
|------------------|------------|--------------------------------------------------------------------|
| `phase`          | `UnifiedPhase` | Identificador estável da fase (ex.: `triage_identity`, `main_service`). |
| `label`          | `string`   | Rótulo curto exibido no HUD/Progress.                              |
| `section`        | `string`   | Agrupamento lógico (`identity`, `service`, `profile`, `extras`).   |
| `milestone`      | `boolean?` | Marca celebração (`triage_celebration`, `main_celebration`).       |
| `nonRenderable`  | `boolean?` | Fase **fantasma** — existe na régua por compat, mas sem UI própria.|

Todos os outros artefatos derivam daqui:

```
REVIEW_PHASE_ORDER     = REVIEW_STEP_CATALOG.map(s => s.phase)
REVIEW_TOTAL_STEPS     = 19   // constante explícita, travada por teste
isReviewPhaseRenderable(phase)
isReviewMilestonePhase(phase)
nextRenderableReviewPhase(phase)
prevRenderableReviewPhase(phase)
```

> **Regra de ouro**: nunca redeclare `REVIEW_PHASE_ORDER` ou
> `REVIEW_TOTAL_STEPS` em outro arquivo. O teste anti-regressão
> `src/test/wizard-review-steps-source-of-truth.test.ts` faz scan global
> em `src/` e falha o build se alguém importar de outro lugar que não
> `wizardReviewSteps.ts` (ou re-export em `wizardReducer.ts`).

---

### 1.2 Milestone (selo dourado)

Fase com `milestone: true` recebe destaque visual:

- **`WizardProgressBar`**: gradiente `bet-amber → bet-orange → bet-green`
  + `box-shadow` âmbar (`hsl(var(--bet-amber)/0.55)`) + ícone `Sparkles`.
- **`Dashboard Assistant`**: card destacado.

Use `isReviewMilestonePhase(phase)` para checar — nunca compare strings
"hardcoded" com `'triage_celebration'`.

---

### 1.3 Anchor (âncora) — quando a fase atual é fantasma

Algumas fases ficam na régua só por compatibilidade histórica
(`main_action`, `main_kind`, `main_location`, `main_contact` —
expurgadas do V2). Se o reducer parar nelas em modo revisão,
`REVIEW_PHASE_ORDER.indexOf(phase) === -1` e o numerador "saltaria"
para 1/19 ou label vazio.

A solução é o hook **`useReviewAnchor(phase, isReview)`**:

```ts
const { anchorPhase, anchorIndex, isAnchored } = useReviewAnchor(state.phase, isReview);
```

| Campo         | Significado                                                    |
|---------------|----------------------------------------------------------------|
| `anchorPhase` | Última fase **renderável** visitada. Use no HUD/ProgressBar.   |
| `anchorIndex` | `REVIEW_PHASE_ORDER.indexOf(anchorPhase)` (≥ 0).               |
| `isAnchored`  | `true` quando a fase atual é fantasma e a âncora difere dela.  |

**Telemetria**: cada nova travessia fantasma → âncora emite o evento
`review_anchor_used` em `onboarding_events` (uma vez por par
`ghost_phase → anchor_phase`). Picos por `ghost_phase` indicam
**regressão de roteamento** — auditável em
`/admin/onboarding-stats` (RPC `admin_review_anchor_audit`).

---

### 1.4 Ghost phase (fase fantasma)

Definição: `nonRenderable === true` no `REVIEW_STEP_CATALOG`.

- **NÃO** entra no `REVIEW_PHASE_ORDER` para fins de navegação real
  (`nextRenderableReviewPhase` / `prevRenderableReviewPhase` pulam ela).
- **ENTRA** para fins de contagem `X/19` (paridade com o Dashboard).
- **NUNCA** é persistida em `sessionStorage`
  (`useReviewPhasePersistence` rejeita).

Se você precisar "remover" uma fase, prefira marcá-la como
`nonRenderable: true` ao invés de deletar — mantém o numerador estável
para usuários que estavam no meio do fluxo.

---

### 1.5 Persistência da última fase renderável

`useReviewPhasePersistence(phase, isReview)` grava em `sessionStorage`
(chave `wizard:review:lastRenderablePhase:v1`) cada fase **renderável**
visitada. Em refresh / volta de rota, `WizardShell` lê via
`readPersistedReviewPhase(true)` e retoma exatamente onde estava —
sem saltos no contador.

Regras:
- Só persiste em `isReview = true`.
- Só aceita fases presentes em `REVIEW_PHASE_ORDER` **E**
  `isReviewPhaseRenderable === true`.
- Limpa em `phase === 'done'` e em `clearPersistedReviewPhase()`
  (chamado no `finalizeUnifiedOnboarding` do shell).
- **Fail-soft**: erros de storage (modo privado, quota) são engolidos.

`?section=` na URL ainda tem **prioridade** sobre a fase persistida
(deep-link explícito do Dashboard Assistant vence o cache local).

---

## 2. Como passar props para o `WizardShell`

```tsx
import WizardShell from '@/components/onboarding/wizard/WizardShell';

<WizardShell
  mode="edit_profile"        // 'new_signup' | 'edit_profile' | 'add_service'
  reviewSection="servicos"   // opcional — deep-link de seção (vence persistência)
/>
```

### 2.1 Prop `mode`
| Valor           | Quando usar                                                        |
|-----------------|--------------------------------------------------------------------|
| `new_signup`    | Default. Fluxo completo para novos usuários (linear, sem skip).    |
| `edit_profile`  | Usuário voltando para revisar/editar. Liga `<EditModeSkipButton>`, persistência de fase, "Voltar" sticky em todas as fases (exceto a 1ª e `done`). |
| `add_service`   | Perfil já existe; foco é adicionar **outro** serviço.              |

> **`reviewMode` (boolean)** está deprecated. Use `mode='edit_profile'`.
> O shell ainda aceita `reviewMode` por compat e o resolve via
> `resolveWizardMode({ mode, reviewMode })`.

### 2.2 Prop `reviewSection`
Quando definida (ou via `?section=` na URL), `WizardShell` salta direto
para a fase mapeada e **ignora** a fase persistida em sessionStorage.
Útil para o Dashboard Assistant abrir uma seção específica.

| `section` (URL/prop) | Fase de destino       |
|----------------------|-----------------------|
| `identidade`         | `triage_identity`     |
| `quem`               | `triage_who`          |
| `cidade`             | `triage_client_city`  |
| `tipo`               | `triage_pro_kind`     |
| `documento`          | `triage_pro_document` |
| `local`              | `triage_pro_location` |
| `servicos`           | `main_service`        |
| `dados`              | `main_document`       |
| `portfolio`          | `main_portfolio_albums` |
| `url`                | `main_extras_b`       |
| `cadastro` / sem section | `triage_identity` (Step 1) |

### 2.3 O que NÃO passar
- `seedState` direto: o shell hidrata via `bootstrap` (banco) +
  `seedBetDraftFromProfile` (localStorage). Forçar `seedState` por fora
  causa **amnésia de dados** (PJ/CNPJ/endereço sumindo na Step 11).
- Phase order ou total: **derive** de `wizardReviewSteps.ts`. Nunca
  hardcode 16/19.

---

## 3. Como o `WizardProgressBar` consome tudo isso

```tsx
<WizardProgressBar
  phase={isReview ? reviewAnchorPhase : state.phase}
  phaseOrder={isReview ? REVIEW_PHASE_ORDER : PROVIDER_WIZARD_PHASE_ORDER}
  totalOverride={isReview ? REVIEW_TOTAL_STEPS : undefined}
  anchored={isReview && reviewIsAnchored}
/>
```

- `phase`: prefere `anchorPhase` em revisão para nunca cair em fase fantasma.
- `totalOverride={19}`: trava o denominador em modo revisão.
- `anchored`: dispara o **shimmer** one-shot (240ms, CSS keyframe
  `wizard-shimmer`, composited via `transform/opacity`) — sinaliza ao
  usuário que algo aconteceu mesmo quando o numerador "segurou".

### 3.1 Acessibilidade do shimmer
- Respeita `prefers-reduced-motion: reduce` via
  `useReducedMotion()` (framer-motion). Quando ativo:
  - Shimmer **não é montado**.
  - Transição de `width` da barra fica **instantânea** (`duration: 0`).
- Anti-reflow: o shimmer usa CSS animation com `transform: translateX`
  + `willChange: transform` (composited layer, sem layout/paint
  contínuo). Antes era `motion.div animate={{x}}` que causava reflow
  por frame em barras finas.
- Atributos expostos no DOM para teste/CSS futuro:
  `data-milestone`, `data-anchored`, `data-shimmer`.

---

## 4. Checklist para mudanças futuras

Antes de mexer em qualquer ponto da régua:

- [ ] Você está editando **apenas** `wizardReviewSteps.ts`? Se a resposta
      é "preciso editar mais de 1 arquivo para mudar a régua", **pare** —
      provavelmente alguém duplicou a fonte. Re-derive.
- [ ] Adicionou fase nova? Coloque em `REVIEW_STEP_CATALOG` com `phase`,
      `label`, `section` e (se for o caso) `milestone`/`nonRenderable`.
- [ ] Removeu fase? Considere marcá-la `nonRenderable: true` antes de
      deletar — preserva o `X/19` para sessões em andamento.
- [ ] Mudou label? `resolveUnifiedPhaseLabel` cai em "Etapa em revisão"
      para fases sem label — a UI nunca mostra string vazia.
- [ ] Os testes abaixo passam?
  - `src/test/wizard-review-steps-source-of-truth.test.ts`
  - `src/test/wizard-review-anchor-and-labels.test.ts`
  - `src/test/wizard-review-phase-persistence.test.ts`
  - `src/test/wizard-progress-bar-shimmer-a11y.test.tsx`
  - `src/test/admin-onboarding-stats-authz.test.ts`
- [ ] Nenhum import direto de `REVIEW_PHASE_ORDER`/`REVIEW_TOTAL_STEPS`/
      `nextRenderableReviewPhase` saiu de
      `wizardReviewSteps.ts` ou do re-export oficial em
      `wizardReducer.ts`. (O teste de fonte única audita isso.)

---

## 5. Cheatsheet de imports

```ts
// Régua canônica
import {
  REVIEW_STEP_CATALOG,
  REVIEW_PHASE_ORDER,
  REVIEW_TOTAL_STEPS,
  isReviewPhaseRenderable,
  isReviewMilestonePhase,
  nextRenderableReviewPhase,
  prevRenderableReviewPhase,
} from '@/components/onboarding/wizard/wizardReviewSteps';

// HUD anchor + label invariante
import {
  useReviewAnchor,
  resolveUnifiedPhaseLabel,
} from '@/components/onboarding/wizard/useReviewAnchor';

// Persistência (refresh-safe)
import {
  readPersistedReviewPhase,
  useReviewPhasePersistence,
  clearPersistedReviewPhase,
} from '@/components/onboarding/wizard/useReviewPhasePersistence';

// Tipo público
import type { UnifiedPhase } from '@/components/onboarding/wizard/wizardReducer';
```

---

## 6. Auditoria operacional

- **`/admin/onboarding-stats`** → card "Âncoras de revisão (X/19)".
  RPC `admin_review_anchor_audit(_days)` (SECURITY DEFINER, exige
  `has_role(admin)`, REVOKE PUBLIC + GRANT authenticated).
- Use `by_ghost_phase` para identificar **qual fase fantasma** está
  sendo atingida com mais frequência — é o sinal direto de regressão
  de roteamento (quem está mandando o reducer para `main_action` etc).
- `recent` lista as 50 últimas ocorrências para correlação com deploys.
