import type { ManifoldNode } from './manifoldTypes';
export interface PriorLayerSnapshot { readonly id?: string; readonly layer: string; readonly stage?: string; readonly liveExecutionEnabled?: boolean; readonly retryEnabled?: boolean; readonly backgroundEnabled?: boolean; readonly realUsersAllowed?: boolean; readonly position?: number; readonly tension?: number; readonly elasticity?: number; readonly neighbors?: readonly string[]; }
function adapt(s: PriorLayerSnapshot): ManifoldNode {
  const id = s.id ?? `${s.layer}:0`;
  const stage = s.stage ?? 'STAGE_0_READ_ONLY';
  const position = s.position ?? 0; const tension = s.tension ?? 0; const elasticity = s.elasticity ?? 1;
  const neighbors = Object.freeze([...(s.neighbors ?? [])].sort());
  return Object.freeze({ id, layer: s.layer, stage, liveExecutionEnabled: s.liveExecutionEnabled ?? false, retryEnabled: s.retryEnabled ?? false, backgroundEnabled: s.backgroundEnabled ?? false, realUsersAllowed: s.realUsersAllowed ?? false, position, tension, elasticity, neighbors, signature: `${id}:${s.layer}:${stage}:${position}:${tension}:${elasticity}:${neighbors.join(',')}` });
}
const make = (layer: string) => (s?: Partial<PriorLayerSnapshot>) => adapt({ ...(s ?? {}), layer });
export const CANONICAL_MANIFOLD_LAYERS: readonly string[] = Object.freeze(['equilibrium-tensor','equilibrium-mechanics','convergence-calculus','canonical-algebra','governance-mesh','immutable-core','enforcement','isolation','integrity','stability','causality','replay','history','recorder','certification','atomic-governance','atomic-promotion','atomic-simulation']);
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
export function adaptAllManifoldInputs(snapshots: readonly PriorLayerSnapshot[]): readonly ManifoldNode[] { return Object.freeze(snapshots.map(adapt)); }
export function buildDefaultManifoldInputs(): readonly ManifoldNode[] { const layers = CANONICAL_MANIFOLD_LAYERS; return Object.freeze(layers.map((layer, i) => { const next = layers[(i + 1) % layers.length]; return adapt({ layer, neighbors: Object.freeze([`${next}:0`]) }); })); }
