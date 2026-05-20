/**
 * Fase 1.9.3 — Runtime Equilibrium Mechanics types (READ-ONLY, deeply immutable).
 */

export type EquilibriumClass =
  | 'STABLE'
  | 'META_STABLE'
  | 'TRANSIENT'
  | 'FRACTURED'
  | 'COLLAPSED';

export type EntropyLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type PropagationEnergy =
  | 'STATIC'
  | 'CONTAINED'
  | 'ACTIVE'
  | 'ESCALATING'
  | 'UNBOUNDED';

export type DissipationClass =
  | 'DISSIPATED'
  | 'STABILIZING'
  | 'PERSISTENT'
  | 'AMPLIFYING'
  | 'RECURSIVE';

export type TopologyTension =
  | 'RELAXED'
  | 'BALANCED'
  | 'STRESSED'
  | 'FRACTURED'
  | 'COLLAPSING';

export type EquilibriumSeverity = 'info' | 'warn' | 'error' | 'critical';

export type EquilibriumViolationCode =
  | 'EQUILIBRIUM_READONLY_INVARIANT_BROKEN'
  | 'EQUILIBRIUM_FRACTURED'
  | 'EQUILIBRIUM_COLLAPSED'
  | 'EQUILIBRIUM_ENTROPY_CRITICAL'
  | 'EQUILIBRIUM_PROPAGATION_UNBOUNDED'
  | 'EQUILIBRIUM_TOPOLOGY_COLLAPSED'
  | 'EQUILIBRIUM_RECURSIVE_AMPLIFICATION'
  | 'EQUILIBRIUM_METASTABLE_DRIFT'
  | 'EQUILIBRIUM_NON_DETERMINISTIC'
  | 'EQUILIBRIUM_CERTIFICATION_INVALID'
  | 'EQUILIBRIUM_MUTATION_DETECTED'
  | 'EQUILIBRIUM_CANONICAL_DRIFT';

export interface EquilibriumNode {
  readonly id: string;
  readonly layer: string;
  readonly stage: string;
  readonly liveExecutionEnabled: boolean;
  readonly retryEnabled: boolean;
  readonly backgroundEnabled: boolean;
  readonly realUsersAllowed: boolean;
  readonly potential: number;
  readonly tension: number;
  readonly neighbors: readonly string[];
  readonly signature: string;
}

export interface RuntimeStabilityField {
  readonly nodes: readonly EquilibriumNode[];
  readonly pressure: number;
  readonly leakage: number;
  readonly localStability: number;
  readonly globalStability: number;
  readonly collapsed: boolean;
  readonly signature: string;
}

export interface RuntimeEntropyEnvelope {
  readonly level: EntropyLevel;
  readonly score: number;
  readonly escalating: boolean;
  readonly collapsed: boolean;
  readonly distribution: readonly number[];
}

export interface RuntimePropagationEnergy {
  readonly energy: PropagationEnergy;
  readonly amplitude: number;
  readonly containment: number;
  readonly amplified: boolean;
  readonly unbounded: boolean;
}

export interface RuntimeDissipationEnvelope {
  readonly classification: DissipationClass;
  readonly score: number;
  readonly recursive: boolean;
  readonly persistent: boolean;
  readonly balance: number;
}

export interface RuntimeTopologyTension {
  readonly tension: TopologyTension;
  readonly nodes: number;
  readonly edges: number;
  readonly stressed: boolean;
  readonly fractured: boolean;
  readonly collapsing: boolean;
  readonly balance: number;
}

export interface MetastableState {
  readonly metastable: boolean;
  readonly score: number;
  readonly temporary: boolean;
  readonly unstable: boolean;
}

export interface EquilibriumCollapseState {
  readonly collapsed: boolean;
  readonly irrecoverable: boolean;
  readonly cascade: boolean;
  readonly radius: number;
}

export interface CanonicalEquilibriumState {
  readonly signature: string;
  readonly drift: number;
  readonly distance: number;
  readonly normalized: boolean;
}

export interface EquilibriumCertification {
  readonly rank: 'FULL' | 'PARTIAL' | 'CONDITIONAL' | 'BLOCKED';
  readonly confidence: number;
  readonly safe: boolean;
  readonly reasons: readonly string[];
}

export interface EquilibriumRisk {
  readonly code: EquilibriumViolationCode;
  readonly severity: EquilibriumSeverity;
  readonly description: string;
}

export interface RuntimeEquilibriumEnvelope {
  readonly id: string;
  readonly field: RuntimeStabilityField;
  readonly entropy: RuntimeEntropyEnvelope;
  readonly propagation: RuntimePropagationEnergy;
  readonly dissipation: RuntimeDissipationEnvelope;
  readonly topology: RuntimeTopologyTension;
  readonly metastable: MetastableState;
  readonly collapse: EquilibriumCollapseState;
  readonly canonical: CanonicalEquilibriumState;
  readonly classification: EquilibriumClass;
  readonly certification: EquilibriumCertification;
  readonly risks: readonly EquilibriumRisk[];
  readonly score: number;
  readonly stable: boolean;
}

export interface RuntimeEquilibriumAggregate {
  readonly envelopes: readonly RuntimeEquilibriumEnvelope[];
  readonly score: number;
  readonly confidence: number;
  readonly worstSeverity: EquilibriumSeverity;
  readonly worstEntropy: EntropyLevel;
  readonly worstPropagation: PropagationEnergy;
  readonly worstTension: TopologyTension;
  readonly stable: boolean;
  readonly risks: readonly EquilibriumRisk[];
}
