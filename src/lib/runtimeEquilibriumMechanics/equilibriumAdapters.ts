/**
 * Fase 1.9.3 — Inert adapters (READ-ONLY).
 */
import type { EquilibriumNode } from './equilibriumTypes';

export interface PriorLayerSnapshot {
  readonly id?: string;
  readonly layer: string;
  readonly stage?: string;
  readonly liveExecutionEnabled?: boolean;
  readonly retryEnabled?: boolean;
  readonly backgroundEnabled?: boolean;
  readonly realUsersAllowed?: boolean;
  readonly potential?: number;
  readonly tension?: number;
  readonly neighbors?: readonly string[];
}

function adapt(s: PriorLayerSnapshot): EquilibriumNode {
  const id = s.id ?? `${s.layer}:0`;
  const stage = s.stage ?? 'STAGE_0_READ_ONLY';
  const potential = s.potential ?? 0;
  const tension = s.tension ?? 0;
  const neighbors = Object.freeze([...(s.neighbors ?? [])].sort());
  return Object.freeze({
    id,
    layer: s.layer,
    stage,
    liveExecutionEnabled: s.liveExecutionEnabled ?? false,
    retryEnabled: s.retryEnabled ?? false,
    backgroundEnabled: s.backgroundEnabled ?? false,
    realUsersAllowed: s.realUsersAllowed ?? false,
    potential,
    tension,
    neighbors,
    signature: `${id}:${s.layer}:${stage}:${potential}:${tension}:${neighbors.join(',')}`,
  });
}

const make = (layer: string) => (s?: Partial<PriorLayerSnapshot>) => adapt({ ...(s ?? {}), layer });

export const adaptConvergenceCalculus = make('convergence-calculus');
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

export const CANONICAL_EQUILIBRIUM_LAYERS: readonly string[] = Object.freeze([
  'convergence-calculus',
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

export function adaptAllEquilibriumInputs(snapshots: readonly PriorLayerSnapshot[]): readonly EquilibriumNode[] {
  return Object.freeze(snapshots.map(adapt));
}

export function buildDefaultEquilibriumInputs(): readonly EquilibriumNode[] {
  const layers = CANONICAL_EQUILIBRIUM_LAYERS;
  // ring topology: each node references next layer's default id to keep topology connected and contained.
  return Object.freeze(
    layers.map((layer, i) => {
      const next = layers[(i + 1) % layers.length];
      return adapt({ layer, neighbors: Object.freeze([`${next}:0`]) });
    }),
  );
}
