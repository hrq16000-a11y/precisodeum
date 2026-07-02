/**
 * phaseComponentMap — registry declarativo de renderers de fase do Wizard V2.
 *
 * PR 12 — UI Composition Finalization. O switch legado foi ELIMINADO: o
 * registry agora cobre TODAS as fases do `OnboardingPhase` (incluindo
 * `phase3_celebration`, `phase_repair_contact` e `done`), e o shell
 * despacha sempre via lookup. Não há mais fallback parcial.
 *
 * REGRAS DE OURO:
 *   - Os componentes mapeados são PUROS (composição visual). Toda a
 *     orquestração (reducer, persist, telemetry, hidratação, submit,
 *     cross-tab, lifecycle, finalize) permanece no shell.
 *   - Props 100% fechadas e tipadas; sem `any`, sem dispatch, sem state
 *     global, sem leitura de storage.
 *
 * Para adicionar uma fase: criar `<PhaseName>Phase.tsx` ao lado, importar
 * aqui e estender `PhaseRendererMap`. O check exaustivo via `satisfies
 * Record<OnboardingPhase, …>` garante cobertura total em tempo de compilação.
 */
import type { ComponentType } from 'react';
import type { OnboardingPhase } from '@/components/onboarding/wizard/phases/v2/types';

import { Phase2ServicePhase, type Phase2ServicePhaseProps } from './Phase2ServicePhase';
import { Phase2DetailsPhase, type Phase2DetailsPhaseProps } from './Phase2DetailsPhase';
import { Phase2PhotosPhase, type Phase2PhotosPhaseProps } from './Phase2PhotosPhase';
import { Phase4DocumentPhase, type Phase4DocumentPhaseProps } from './Phase4DocumentPhase';
import { Phase4AvatarPhase, type Phase4AvatarPhaseProps } from './Phase4AvatarPhase';
import { Phase4ExtrasAPhase, type Phase4ExtrasAPhaseProps } from './Phase4ExtrasAPhase';
import { Phase4ExtrasBPhase, type Phase4ExtrasBPhaseProps } from './Phase4ExtrasBPhase';
import { Phase3CelebrationPhase, type Phase3CelebrationPhaseProps } from './Phase3CelebrationPhase';
import { PhaseRepairContactPhase, type PhaseRepairContactPhaseProps } from './PhaseRepairContactPhase';
import { DonePhase, type DonePhaseProps } from './DonePhase';

/** Mapeia cada fase ao seu componente + ao shape de props esperado. */
export interface PhaseRendererMap {
  phase2_service: { Component: ComponentType<Phase2ServicePhaseProps>; props: Phase2ServicePhaseProps };
  phase2_details: { Component: ComponentType<Phase2DetailsPhaseProps>; props: Phase2DetailsPhaseProps };
  phase2_photos: { Component: ComponentType<Phase2PhotosPhaseProps>; props: Phase2PhotosPhaseProps };
  phase3_celebration: { Component: ComponentType<Phase3CelebrationPhaseProps>; props: Phase3CelebrationPhaseProps };
  phase4_document: { Component: ComponentType<Phase4DocumentPhaseProps>; props: Phase4DocumentPhaseProps };
  phase4_avatar: { Component: ComponentType<Phase4AvatarPhaseProps>; props: Phase4AvatarPhaseProps };
  phase4_extras_a: { Component: ComponentType<Phase4ExtrasAPhaseProps>; props: Phase4ExtrasAPhaseProps };
  phase4_extras_b: { Component: ComponentType<Phase4ExtrasBPhaseProps>; props: Phase4ExtrasBPhaseProps };
  phase_repair_contact: { Component: ComponentType<PhaseRepairContactPhaseProps>; props: PhaseRepairContactPhaseProps };
  done: { Component: ComponentType<DonePhaseProps>; props: DonePhaseProps };
}

/**
 * `MigratedPhase` continua exportada por compat dos testes/imports antigos,
 * mas agora coincide 1:1 com `OnboardingPhase` — todas as fases migraram.
 */
export type MigratedPhase = keyof PhaseRendererMap;

/**
 * Registry de componentes — TYPE-EXHAUSTIVE. O `satisfies` garante em
 * compile-time que toda fase de `OnboardingPhase` possui um renderer.
 */
export const phaseComponentMap = {
  phase2_service: Phase2ServicePhase,
  phase2_details: Phase2DetailsPhase,
  phase2_photos: Phase2PhotosPhase,
  phase3_celebration: Phase3CelebrationPhase,
  phase4_document: Phase4DocumentPhase,
  phase4_avatar: Phase4AvatarPhase,
  phase4_extras_a: Phase4ExtrasAPhase,
  phase4_extras_b: Phase4ExtrasBPhase,
  phase_repair_contact: PhaseRepairContactPhase,
  done: DonePhase,
} as const satisfies Record<OnboardingPhase, ComponentType<any>>;

/**
 * Type-guard puro. Após PR 12 todas as fases estão cobertas, então este
 * guard sempre retorna `true` — mantido por compat com testes/legado e
 * para defesa em depth contra impossible states.
 */
export function isMigratedPhase(phase: OnboardingPhase): phase is MigratedPhase {
  return phase in phaseComponentMap;
}

export type {
  Phase2ServicePhaseProps,
  Phase2DetailsPhaseProps,
  Phase2PhotosPhaseProps,
  Phase3CelebrationPhaseProps,
  Phase4DocumentPhaseProps,
  Phase4AvatarPhaseProps,
  Phase4ExtrasAPhaseProps,
  Phase4ExtrasBPhaseProps,
  PhaseRepairContactPhaseProps,
  DonePhaseProps,
};
