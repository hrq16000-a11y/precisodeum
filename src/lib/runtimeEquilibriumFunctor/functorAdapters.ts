import type { FunctorObject } from './functorTypes';

export interface PriorFunctorSnapshot {
  readonly id?: string;
  readonly layer: string;
  readonly stage?: string;
  readonly liveExecutionEnabled?: boolean;
  readonly retryEnabled?: boolean;
  readonly backgroundEnabled?: boolean;
  readonly realUsersAllowed?: boolean;
  readonly preservation?: number;
  readonly identity?: number;
  readonly determinism?: number;
  readonly stability?: number;
  readonly morphisms?: readonly string[];
}

function adapt(s: PriorFunctorSnapshot): FunctorObject {
  const id = s.id ?? `${s.layer}:0`;
  const stage = s.stage ?? 'STAGE_0_READ_ONLY';
  const preservation = s.preservation ?? 1;
  const identity = s.identity ?? 1;
  const determinism = s.determinism ?? 1;
  const stability = s.stability ?? 1;
  const morphisms = Object.freeze([...(s.morphisms ?? [])].sort());
  return Object.freeze({
    id, layer: s.layer, stage,
    liveExecutionEnabled: s.liveExecutionEnabled ?? false,
    retryEnabled: s.retryEnabled ?? false,
    backgroundEnabled: s.backgroundEnabled ?? false,
    realUsersAllowed: s.realUsersAllowed ?? false,
    preservation, identity, determinism, stability, morphisms,
    signature: `${id}:${s.layer}:${stage}:${preservation}:${identity}:${determinism}:${stability}:${morphisms.join(',')}`,
  });
}

const make = (layer: string) => (s?: Partial<PriorFunctorSnapshot>) => adapt({ ...(s ?? {}), layer });

export const CANONICAL_FUNCTOR_LAYERS: readonly string[] = Object.freeze([
  'equilibrium-category','equilibrium-manifold','equilibrium-tensor','equilibrium-mechanics','convergence-calculus',
  'canonical-algebra','governance-mesh','immutable-core','enforcement','isolation','integrity','stability',
  'causality','replay','history','recorder','certification','atomic-governance','atomic-promotion','atomic-simulation',
]);

export const adaptEquilibriumCategory = make('equilibrium-category');
export const adaptEquilibriumManifold = make('equilibrium-manifold');
export const adaptEquilibriumTensor = make('equilibrium-tensor');
export const adaptEquilibriumMechanics = make('equilibrium-mechanics');
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

export function adaptAllFunctorInputs(snapshots: readonly PriorFunctorSnapshot[]): readonly FunctorObject[] {
  return Object.freeze(snapshots.map(adapt));
}

export function buildDefaultFunctorInputs(): readonly FunctorObject[] {
  const layers = CANONICAL_FUNCTOR_LAYERS;
  return Object.freeze(layers.map((layer, i) => {
    const next = layers[(i + 1) % layers.length];
    return adapt({ layer, morphisms: Object.freeze([`${next}:0`]) });
  }));
}
