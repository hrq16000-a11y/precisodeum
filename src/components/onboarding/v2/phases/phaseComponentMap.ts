/**
 * phaseComponentMap — registry declarativo de renderers de fase do Wizard V2.
 *
 * PR 10/11 — UI Composition Pass. Estratégia HÍBRIDA INCREMENTAL:
 *   - As fases listadas aqui são resolvidas via lookup no map (router
 *     declarativo). O shell delega `<Component {...phaseProps} />`.
 *   - As fases ainda não migradas seguem no `switch (state.phase)` legado.
 *
 * REGRAS DE OURO:
 *   - Os componentes mapeados são PUROS (composição visual). Toda a
 *     orquestração (reducer, persist, telemetry, hidratação, submit,
 *     cross-tab, lifecycle, finalize) permanece no shell.
 *   - Props 100% fechadas e tipadas; sem `any`, sem dispatch, sem state
 *     global, sem leitura de storage.
 *
 * Para migrar uma nova fase: criar `<PhaseName>Phase.tsx` ao lado e
 * adicioná-la aqui. O shell automaticamente passa a usá-la.
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

/** Mapeia cada fase migrada ao seu componente + ao shape de props esperado. */
export interface PhaseRendererMap {
  phase2_service: { Component: ComponentType<Phase2ServicePhaseProps>; props: Phase2ServicePhaseProps };
  phase2_details: { Component: ComponentType<Phase2DetailsPhaseProps>; props: Phase2DetailsPhaseProps };
  phase2_photos: { Component: ComponentType<Phase2PhotosPhaseProps>; props: Phase2PhotosPhaseProps };
  phase4_document: { Component: ComponentType<Phase4DocumentPhaseProps>; props: Phase4DocumentPhaseProps };
  phase4_avatar: { Component: ComponentType<Phase4AvatarPhaseProps>; props: Phase4AvatarPhaseProps };
  phase4_extras_a: { Component: ComponentType<Phase4ExtrasAPhaseProps>; props: Phase4ExtrasAPhaseProps };
  phase4_extras_b: { Component: ComponentType<Phase4ExtrasBPhaseProps>; props: Phase4ExtrasBPhaseProps };
}

export type MigratedPhase = keyof PhaseRendererMap;

/**
 * Registry de componentes. Indexado pelo nome da fase; o lookup retorna
 * `undefined` para fases ainda não migradas (caem no switch legado).
 */
export const phaseComponentMap = {
  phase2_service: Phase2ServicePhase,
  phase2_details: Phase2DetailsPhase,
  phase2_photos: Phase2PhotosPhase,
  phase4_document: Phase4DocumentPhase,
  phase4_avatar: Phase4AvatarPhase,
  phase4_extras_a: Phase4ExtrasAPhase,
  phase4_extras_b: Phase4ExtrasBPhase,
} as const satisfies Record<MigratedPhase, ComponentType<any>>;

/** Type-guard puro: a fase atual está coberta pelo router declarativo? */
export function isMigratedPhase(phase: OnboardingPhase): phase is MigratedPhase {
  return phase in phaseComponentMap;
}

export type {
  Phase2ServicePhaseProps,
  Phase2DetailsPhaseProps,
  Phase2PhotosPhaseProps,
  Phase4DocumentPhaseProps,
  Phase4AvatarPhaseProps,
  Phase4ExtrasAPhaseProps,
  Phase4ExtrasBPhaseProps,
};
