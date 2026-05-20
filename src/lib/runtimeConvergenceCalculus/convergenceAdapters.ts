/**
 * Fase 1.9.2 — Inert adapters mapping prior runtime layers into ConvergenceNode raw inputs.
 * READ-ONLY, no side-effects.
 */

import type { RawConvergenceNodeInput } from './convergenceSpace';

export interface PriorLayerSnapshot {
  readonly id?: string;
  readonly layer: string;
  readonly stage?: string;
  readonly liveExecutionEnabled?: boolean;
  readonly retryEnabled?: boolean;
  readonly backgroundEnabled?: boolean;
  readonly realUsersAllowed?: boolean;
  readonly value?: number;
  readonly successors?: readonly string[];
}

function adaptSnapshot(s: PriorLayerSnapshot): RawConvergenceNodeInput {
  return Object.freeze({
    id: s.id ?? `${s.layer}:0`,
    layer: s.layer,
    stage: s.stage ?? 'STAGE_0_READ_ONLY',
    liveExecutionEnabled: s.liveExecutionEnabled ?? false,
    retryEnabled: s.retryEnabled ?? false,
    backgroundEnabled: s.backgroundEnabled ?? false,
    realUsersAllowed: s.realUsersAllowed ?? false,
    value: s.value ?? 0,
    successors: Object.freeze([...(s.successors ?? [])]),
  });
}

const make = (layer: string) => (s?: Partial<PriorLayerSnapshot>) =>
  adaptSnapshot({ ...(s ?? {}), layer });

export const adaptCanonicalAlgebra = make('canonical-algebra');
export const adaptGovernanceMesh = make('governance-mesh');
export const adaptImmutableCore = make('immutable-core');
export const adaptEnforcement = make('enforcement');
export const adaptIsolation = make('isolation');
export const adaptIntegrity = make('integrity');
export const adaptStability = make('stability');
export const adaptCausality = make('causality');
export const adaptReplay = make('replay');
export const adaptHistory = make('history');
export const adaptRecorder = make('recorder');
export const adaptCertification = make('certification');
export const adaptAtomicGovernance = make('atomic-governance');
export const adaptAtomicPromotion = make('atomic-promotion');
export const adaptAtomicSimulation = make('atomic-simulation');

export const CANONICAL_CONVERGENCE_LAYERS: readonly string[] = Object.freeze([
  'canonical-algebra',
  'governance-mesh',
  'immutable-core',
  'enforcement',
  'isolation',
  'integrity',
  'stability',
  'causality',
  'replay',
  'history',
  'recorder',
  'certification',
  'atomic-governance',
  'atomic-promotion',
  'atomic-simulation',
]);

export function adaptAllConvergenceInputs(
  snapshots: readonly PriorLayerSnapshot[],
): readonly RawConvergenceNodeInput[] {
  return Object.freeze(snapshots.map(adaptSnapshot));
}

export function buildDefaultConvergenceInputs(): readonly RawConvergenceNodeInput[] {
  return Object.freeze(
    CANONICAL_CONVERGENCE_LAYERS.map((layer) => adaptSnapshot({ layer })),
  );
}
