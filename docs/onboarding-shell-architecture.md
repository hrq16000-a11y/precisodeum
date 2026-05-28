# Onboarding V2 Shell — Architecture Contract

> Atualizado em: PR 16 (UI Composition Pass concluído).
> Próxima evolução planejada: PR 17–20 (runtime extraction → shell <200 LOC).

Este documento congela o **contrato arquitetural** do `OnboardingV2Shell` após
a sequência de PRs 12–16. Serve como blueprint anti-regressão para qualquer
refactor futuro: se você está prestes a mexer no shell, leia isto antes.

---

## 1. Visão geral em camadas

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                       WizardShell (rota /cadastro-inicial)              │
│                                                                         │
│   alias MainOrchestrator  →  OnboardingV2Shell  ←  alias TriageOrch.    │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────────┐
        ▼                         ▼                             ▼
┌──────────────────┐    ┌────────────────────┐     ┌─────────────────────────┐
│ RUNTIME LAYER    │    │ COMPOSITION LAYER  │     │ PRESENTATION LAYER      │
│ (shell-owned)    │    │ (pure builders)    │     │ (phaseComponentMap)     │
│                  │    │                    │     │                         │
│ • reducer        │    │ • buildShell-      │     │ • Phase2ServicePhase    │
│ • autosave       │    │   RenderState      │     │ • Phase2DetailsPhase    │
│ • orchestrators  │    │ • buildShell-      │     │ • Phase2PhotosPhase     │
│ • hydration      │    │   ChromeProps      │     │ • Phase3CelebrationP.   │
│ • submit/finalize│    │ • buildShell-      │     │ • Phase4DocumentPhase   │
│ • cross-tab      │    │   ModalProps       │     │ • Phase4AvatarPhase     │
│ • telemetry      │    │ • buildPhase-      │     │ • Phase4ExtrasA/BPhase  │
│ • leader-gate    │    │   VisualState      │     │ • PhaseRepairContactP.  │
│ • zombie guard   │    │ • buildPhaseProps  │     │ • DonePhase             │
│ • exit guard     │    │   (encouragements) │     │                         │
└──────────────────┘    └────────────────────┘     └─────────────────────────┘
```

### Princípio do contrato

> **Composição visual nunca importa runtime. Runtime nunca constrói JSX denso.**

A camada de composição é 100% pura: funções recebem snapshots imutáveis e
retornam objetos imutáveis. Toda decisão de lifecycle, persistência, dispatch
ou efeito permanece no shell.

---

## 2. Registry de fases — `phaseComponentMap`

Arquivo: `src/components/onboarding/v2/phases/phaseComponentMap.ts`

- **Type-exhaustive**: `satisfies Record<OnboardingPhase, ComponentType<any>>`
  garante em compile-time que toda fase tem um renderer.
- **Sem switch legado**: o shell despacha 100% via lookup.
- **Wrappers folha**: cada `<Phase*>Phase.tsx` recebe props tipadas e fechadas
  (sem `any`, sem dispatch, sem storage, sem refs persistentes).
- **Para adicionar uma fase**: criar `<NomeDaFase>Phase.tsx`, importar no
  registry e estender `PhaseRendererMap`. Esquecer o registry quebra `tsc`.

### Como adicionar uma fase nova

```ts
// 1. wrapper visual em src/components/onboarding/v2/phases/NovaFase.tsx
export interface NovaFasePhaseProps { /* fechado, sem any */ }
export const NovaFasePhase = (props: NovaFasePhaseProps) => <div>…</div>;

// 2. registrar no phaseComponentMap.ts
import { NovaFasePhase, type NovaFasePhaseProps } from './NovaFase';

interface PhaseRendererMap {
  // …
  nova_fase: { Component: ComponentType<NovaFasePhaseProps>; props: NovaFasePhaseProps };
}

export const phaseComponentMap = {
  // …
  nova_fase: NovaFasePhase,
} as const satisfies Record<OnboardingPhase, ComponentType<any>>;
```

---

## 3. Chrome & Modais — `v2/layout/`

| Arquivo                          | Responsabilidade                                              |
|----------------------------------|---------------------------------------------------------------|
| `OnboardingShellChrome.tsx`      | DraftRestoredBanner + BetCardShell + AutoSaveBadge + transição motion |
| `OnboardingShellModals.tsx`      | RemoteDraftRecoveryModal + WizardErrorModal                   |
| `buildShellChromeProps.ts`       | Builder puro de props do chrome                               |
| `buildShellModalProps.ts`        | `buildRemoteDraftSnapshot` + `buildErrorContextSnapshot`      |
| `buildPhaseVisualState.ts`       | Snapshot mínimo de derivações visuais (`phaseKey`, badge)     |
| `buildShellRenderState.ts`       | **Coordinator único** — consolida os 4 builders acima         |
| `buildPhaseLayoutProps.ts`       | `buildRegistrationSnapshotPayload` (Step Final)               |
| `buildPhaseActionGroups.ts`      | `recordExtrasBRegistrationSnapshot` (fire-and-forget)         |

Todos são **puros** (sem hooks, sem refs, sem effects, sem fetch, sem storage,
sem dispatch). Se um builder começar a precisar de side-effects, ele NÃO
pertence à camada de composição — promova para um hook em `src/hooks/onboarding/`.

---

## 4. Orchestrators (runtime — shell-owned)

Localizados em `src/hooks/onboarding/`:

| Hook                                  | Domínio                                            |
|---------------------------------------|----------------------------------------------------|
| `useHydrationCoreOrchestrator`        | Hidratação inicial (seed, draft local, draft remoto) |
| `usePhaseTransitionOrchestrator`      | Sequenciamento entre fases + telemetria de transição |
| `usePersistenceRecoveryOrchestrator`  | Retry de persistência (providers/profiles)         |
| `useSubmitCoreOrchestrator`           | Submit do 1º serviço + finalize do onboarding      |
| `useBackNavigationOrchestrator`       | Voltar/cancelar com guards                         |
| `useCrossTabRecoveryOrchestrator`     | Reconciliação multi-aba                            |
| `useLeaderWriteGate`                  | Eleição de aba líder p/ writes únicos              |
| `useOnboardingViewModel`              | Derivações visuais memoizadas (`showAutoSaveBadge`)|

**Regra de ouro**: cada orchestrator é independente. Não há dependência
circular. O shell os monta em ordem fixa documentada no início do arquivo.

---

## 5. Builders puros — `v2/phases/buildPhaseProps.ts`

| Função                                    | Saída                          |
|-------------------------------------------|--------------------------------|
| `buildPhase2ServiceEncouragement`         | Checklist + nextStep da Fase 2 (serviço) |
| `buildPhase2DetailsEncouragement`         | Checklist + nextStep da Fase 2 (detalhes) |
| `buildPhase2PhotosReadyEncouragement`     | Variant `celebrate`/`gentle` para fotos |
| `buildPhase2PhotosBlockedDiagnostics`     | `reason` + campos faltantes + `blockCode` canônico |

Garantidos por testes em:
- `src/test/onboarding-phase-component-map.test.tsx` — cobertura do registry
- `src/test/onboarding-build-phase-props.test.ts` — pureza dos builders

---

## 6. Invariantes anti-regressão (NÃO VIOLAR)

1. **Zero runtime no `phaseComponentMap`**: wrappers não importam `supabase`,
   `useAuth`, storage, telemetria ou dispatch.
2. **Zero JSX em builders**: arquivos `build*.ts` retornam apenas objetos.
3. **`OnboardingViewModel` mínimo**: só campos efetivamente consumidos pelo
   chrome. Adicionar nova derivação só se houver consumidor real.
4. **`satisfies Record<OnboardingPhase, …>`** no registry — não substituir
   por `as` ou índice solto.
5. **Sem `any` em props de wrapper**: cada `*PhaseProps` é interface fechada.
6. **Sem mutação de inputs nos builders**: testes de pureza falham se você
   tentar.
7. **Cores Bet Mode**: todo wrapper usa tokens `bet-*` (`bg-bet-amber`,
   `text-bet-fg`, …). Cores cruas (`bg-blue-500`, `text-purple-600`, etc.)
   são proibidas e capturadas em `bet-palette-regression.test.ts`.

---

## 7. Roadmap PR 17–20 (runtime extraction)

Objetivo: reduzir `OnboardingV2Shell.tsx` de ~2570 LOC para <200 LOC,
extraindo runtime em hooks compostos. Cada PR deve manter **zero runtime diff**
e ser validado contra hidratação, submit, cross-tab e finalize.

| PR    | Escopo                                                                    | Risco |
|-------|---------------------------------------------------------------------------|-------|
| PR 17 | Extrair helpers de telemetria + lifecycle (sem dispatch cruzado)          | Baixo |
| PR 18 | `useOnboardingShellRuntime()` — reducer + autosave + orchestrators        | Alto  |
| PR 19 | `useOnboardingSubmitFlow()` — submit + finalize + integridade             | Alto  |
| PR 20 | Shell final: runtime owner + registry dispatcher (<200 LOC)               | Médio |

Cada PR exige:
- `tsc --noEmit` verde
- Testes de wizard verdes (48+ casos)
- Snapshot manual de fluxo completo (cadastro novo + modo revisão)
- Validação cross-tab (2 abas simultâneas)
