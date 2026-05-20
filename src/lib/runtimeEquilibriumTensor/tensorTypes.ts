/** Fase 1.9.4 — Types (READ-ONLY). */
export type TensorStabilityClass = 'STABLE' | 'CURVED' | 'STRESSED' | 'FRACTURED' | 'SINGULAR';
export type CurvatureClass = 'FLAT' | 'CONTAINED' | 'AMPLIFIED' | 'RECURSIVE' | 'UNBOUNDED';
export type InstabilityDensity = 'VOID' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TopologyDeformation = 'NONE' | 'LOCAL' | 'DISTRIBUTED' | 'FRACTURED' | 'COLLAPSING';
export type SingularityClass = 'NONE' | 'LOCALIZED' | 'PROPAGATING' | 'RECURSIVE' | 'TERMINAL';
export type TensorSeverity = 'info' | 'warn' | 'error' | 'critical';

export interface TensorNode {
  readonly id: string;
  readonly layer: string;
  readonly stage: string;
  readonly liveExecutionEnabled: boolean;
  readonly retryEnabled: boolean;
  readonly backgroundEnabled: boolean;
  readonly realUsersAllowed: boolean;
  readonly pressure: number;
  readonly curvature: number;
  readonly density: number;
  readonly neighbors: readonly string[];
  readonly signature: string;
}
export interface RuntimeStabilityGeometry { readonly nodes: readonly TensorNode[]; readonly pressure: number; readonly balance: number; readonly collapsed: boolean; readonly signature: string; }
export interface RuntimeEquilibriumTensor { readonly field: readonly number[]; readonly symmetry: number; readonly normalized: boolean; readonly unstable: boolean; readonly signature: string; }
export interface RuntimeCurvatureEnvelope { readonly class: CurvatureClass; readonly value: number; readonly containment: number; readonly recursive: boolean; readonly unbounded: boolean; }
export interface RuntimeInstabilityDensityEnvelope { readonly level: InstabilityDensity; readonly score: number; readonly amplified: boolean; readonly distribution: readonly number[]; }
export interface RuntimeContainmentField { readonly strength: number; readonly leaking: boolean; readonly fragmented: boolean; readonly fragments: number; }
export interface RuntimeTopologyGeometry { readonly deformation: TopologyDeformation; readonly stress: number; readonly fractured: boolean; readonly collapsing: boolean; }
