export type TensorStabilityClass = 'STABLE' | 'CURVED' | 'STRESSED' | 'FRACTURED' | 'SINGULAR';
export type CurvatureClass = 'FLAT' | 'CONTAINED' | 'AMPLIFIED' | 'RECURSIVE' | 'UNBOUNDED';
export type InstabilityDensity = 'VOID' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TopologyDeformation = 'NONE' | 'LOCAL' | 'DISTRIBUTED' | 'FRACTURED' | 'COLLAPSING';
export type SingularityClass = 'NONE' | 'LOCALIZED' | 'PROPAGATING' | 'RECURSIVE' | 'TERMINAL';
export type TensorSeverity = 'info' | 'warn' | 'error' | 'critical';
export interface TensorNode { readonly id: string; readonly layer: string; readonly stage: string; readonly liveExecutionEnabled: boolean; readonly retryEnabled: boolean; readonly backgroundEnabled: boolean; readonly realUsersAllowed: boolean; readonly pressure: number; readonly curvature: number; readonly density: number; readonly neighbors: readonly string[]; readonly signature: string; }
export interface RuntimeStabilityGeometry { readonly nodes: readonly TensorNode[]; readonly pressure: number; readonly balance: number; readonly collapsed: boolean; readonly signature: string; }
export interface RuntimeEquilibriumTensor { readonly field: readonly number[]; readonly symmetry: number; readonly normalized: boolean; readonly unstable: boolean; readonly signature: string; }
export interface RuntimeCurvatureEnvelope { readonly class: CurvatureClass; readonly value: number; readonly containment: number; readonly recursive: boolean; readonly unbounded: boolean; }
export interface RuntimeInstabilityDensityEnvelope { readonly level: InstabilityDensity; readonly score: number; readonly amplified: boolean; readonly distribution: readonly number[]; }
export interface RuntimeContainmentField { readonly strength: number; readonly leaking: boolean; readonly fragmented: boolean; readonly fragments: number; }
export interface RuntimeTopologyGeometry { readonly deformation: TopologyDeformation; readonly stress: number; readonly fractured: boolean; readonly collapsing: boolean; }
export interface RuntimeConvergenceGradient { readonly value: number; readonly reversed: boolean; readonly unstable: boolean; readonly equilibrium: number; }
export interface RuntimeSingularityEnvelope { readonly class: SingularityClass; readonly radius: number; readonly recursive: boolean; readonly terminal: boolean; }
export interface RuntimeCollapseGeometry { readonly collapsing: boolean; readonly cascade: boolean; readonly containment: number; }
export interface TensorRisk { readonly code: string; readonly severity: TensorSeverity; readonly description: string; }
export interface TensorCertification { readonly safe: boolean; readonly confidence: number; readonly rank: 'OK' | 'WARN' | 'BLOCKED'; readonly reasons: readonly string[]; }
export interface RuntimeTensorEnvelope { readonly id: string; readonly geometry: RuntimeStabilityGeometry; readonly tensor: RuntimeEquilibriumTensor; readonly curvature: RuntimeCurvatureEnvelope; readonly density: RuntimeInstabilityDensityEnvelope; readonly containment: RuntimeContainmentField; readonly topology: RuntimeTopologyGeometry; readonly gradient: RuntimeConvergenceGradient; readonly singularity: RuntimeSingularityEnvelope; readonly collapse: RuntimeCollapseGeometry; readonly classification: TensorStabilityClass; readonly certification: TensorCertification; readonly risks: readonly TensorRisk[]; readonly score: number; readonly stable: boolean; }
export interface RuntimeTensorAggregate { readonly envelopes: readonly RuntimeTensorEnvelope[]; readonly score: number; readonly confidence: number; readonly worstSeverity: TensorSeverity; readonly worstCurvature: CurvatureClass; readonly worstDensity: InstabilityDensity; readonly worstDeformation: TopologyDeformation; readonly worstSingularity: SingularityClass; readonly stable: boolean; readonly risks: readonly TensorRisk[]; }
