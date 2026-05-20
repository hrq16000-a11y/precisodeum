/**
 * Fase 1.9.12 — Recursive Equilibrium types (READ-ONLY, deterministic, serializable).
 */

export type ReqStage = 'STAGE_0_READ_ONLY';

export type ReqEquilibriumClass =
  | 'STABLE'
  | 'RECOVERING'
  | 'OSCILLATING'
  | 'COLLAPSED'
  | 'DIVERGENT'
  | 'SEALED';

export type ReqContainmentClass =
  | 'isolated'
  | 'bounded'
  | 'recursive'
  | 'leaking'
  | 'collapsing';

export type ReqPropagationMode =
  | 'bounded'
  | 'recursive'
  | 'overflow'
  | 'infinite'
  | 'stable';

export type ReqReductionMode =
  | 'normal'
  | 'idempotent'
  | 'unstable'
  | 'infinite';

export type ReqTopologyMode =
  | 'discrete'
  | 'connected'
  | 'cyclic'
  | 'collapsed'
  | 'unreachable';

export type ReqEquivalenceKind =
  | 'exact'
  | 'structural'
  | 'convergent'
  | 'recursive'
  | 'invalid';

export type ReqCertificationRank =
  | 'CERTIFIED'
  | 'CONDITIONALLY_CERTIFIED'
  | 'UNSTABLE'
  | 'BLOCKED';

export type ReqConvergenceClass =
  | 'SEALED'
  | 'STABLE'
  | 'EVENTUAL'
  | 'OSCILLATING'
  | 'DIVERGENT';

export type ReqSeverity = 'info' | 'warn' | 'error' | 'critical';

export type ReqViolationCode =
  | 'REQ_READONLY_INVARIANT_BROKEN'
  | 'REQ_DETERMINISM_BROKEN'
  | 'REQ_FREEZE_BROKEN'
  | 'REQ_TOPOLOGY_BROKEN'
  | 'REQ_EQUILIBRIUM_BROKEN'
  | 'REQ_CONTAINMENT_BROKEN'
  | 'REQ_PROPAGATION_OVERFLOW'
  | 'REQ_CERTIFICATION_INVALID'
  | 'REQ_AGGREGATE_INCONSISTENT'
  | 'REQ_CLOSURE_OPEN';

export interface ReqNode {
  readonly id: string;
  readonly layer: string;
  readonly potential: number;
  readonly depth: number;
  readonly signature: string;
}

export interface ReqEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly weight: number;
}

export interface ReqSystem {
  readonly id: string;
  readonly nodes: readonly ReqNode[];
  readonly edges: readonly ReqEdge[];
  readonly signature: string;
}

export interface ReqEquilibriumPoint {
  readonly id: string;
  readonly path: readonly string[];
  readonly iterations: number;
  readonly cycle: boolean;
  readonly diverged: boolean;
  readonly recovered: boolean;
  readonly equilibriumClass: ReqEquilibriumClass;
}

export interface ReqResolution {
  readonly system: ReqSystem;
  readonly points: readonly ReqEquilibriumPoint[];
  readonly cycles: readonly (readonly string[])[];
  readonly unreachable: readonly string[];
}

export interface ReqComposition {
  readonly associative: boolean;
  readonly closed: boolean;
  readonly violations: readonly string[];
}

export interface ReqIdentity {
  readonly identityCount: number;
  readonly missing: readonly string[];
  readonly canonical: boolean;
  readonly idempotent: boolean;
}

export interface ReqNormalization {
  readonly signature: string;
  readonly idempotent: boolean;
  readonly mode: ReqReductionMode;
}

export interface ReqDeterminism {
  readonly stable: boolean;
  readonly signature: string;
  readonly replays: number;
}

export interface ReqEquivalence {
  readonly classes: readonly (readonly string[])[];
  readonly kind: ReqEquivalenceKind;
  readonly symmetric: boolean;
  readonly transitive: boolean;
}

export interface ReqReduction {
  readonly mode: ReqReductionMode;
  readonly steps: number;
  readonly signature: string;
}

export interface ReqTopology {
  readonly mode: ReqTopologyMode;
  readonly connectedComponents: number;
  readonly cyclic: boolean;
  readonly collapsed: boolean;
  readonly unreachable: boolean;
}

export interface ReqStability {
  readonly bounded: boolean;
  readonly oscillation: boolean;
  readonly recoveryRate: number;
  readonly containment: number;
}

export interface ReqCertification {
  readonly rank: ReqCertificationRank;
  readonly confidence: number;
  readonly reasons: readonly string[];
}

export interface ReqContainment {
  readonly classification: ReqContainmentClass;
  readonly leaking: boolean;
  readonly collapsing: boolean;
  readonly depth: number;
}

export interface ReqPropagation {
  readonly mode: ReqPropagationMode;
  readonly depth: number;
  readonly overflow: boolean;
  readonly bounded: boolean;
}

export interface ReqClosure {
  readonly closed: boolean;
  readonly missing: readonly string[];
  readonly signature: string;
}

export interface ReqConvergenceModel {
  readonly classification: ReqConvergenceClass;
  readonly confidence: number;
  readonly regressed: boolean;
  readonly recovered: boolean;
}

export interface ReqViolation {
  readonly code: ReqViolationCode;
  readonly severity: ReqSeverity;
  readonly target: string;
  readonly description: string;
}

export interface ReqEnvelope {
  readonly id: string;
  readonly system: ReqSystem;
  readonly resolution: ReqResolution;
  readonly composition: ReqComposition;
  readonly identity: ReqIdentity;
  readonly normalization: ReqNormalization;
  readonly determinism: ReqDeterminism;
  readonly equivalence: ReqEquivalence;
  readonly reduction: ReqReduction;
  readonly topology: ReqTopology;
  readonly stability: ReqStability;
  readonly certification: ReqCertification;
  readonly containment: ReqContainment;
  readonly propagation: ReqPropagation;
  readonly closure: ReqClosure;
  readonly convergence: ReqConvergenceModel;
  readonly signature: string;
}

export interface ReqAggregate {
  readonly envelopes: readonly ReqEnvelope[];
  readonly score: number;
  readonly confidence: number;
  readonly stable: boolean;
  readonly violations: readonly ReqViolation[];
  readonly signature: string;
}

export interface ReqInternals {
  readonly stage: ReqStage;
  readonly liveExecutionEnabled: false;
  readonly retryEnabled: false;
  readonly backgroundEnabled: false;
  readonly realUsersAllowed: false;
}
