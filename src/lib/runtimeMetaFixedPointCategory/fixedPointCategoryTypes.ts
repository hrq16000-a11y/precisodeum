/**
 * Fase 1.9.11 — Meta Fixed-Point Category types (READ-ONLY, deterministic).
 */

export type FpcStage = 'STAGE_0_READ_ONLY';

export type FpcConvergenceClass =
  | 'SEALED'
  | 'STABLE'
  | 'EVENTUAL'
  | 'OSCILLATING'
  | 'DIVERGENT';

export type FpcContainmentClass =
  | 'isolated'
  | 'bounded'
  | 'recursive'
  | 'leaking'
  | 'collapsing';

export type FpcCertificationRank =
  | 'CERTIFIED'
  | 'CONDITIONALLY_CERTIFIED'
  | 'UNSTABLE'
  | 'BLOCKED';

export type FpcTopologyMode =
  | 'discrete'
  | 'connected'
  | 'cyclic'
  | 'collapsed'
  | 'unreachable';

export type FpcEquivalenceKind =
  | 'exact'
  | 'structural'
  | 'convergent'
  | 'recursive'
  | 'invalid';

export type FpcReductionMode =
  | 'normal'
  | 'idempotent'
  | 'unstable'
  | 'infinite';

export type FpcSeverity = 'info' | 'warn' | 'error' | 'critical';

export type FpcViolationCode =
  | 'FPC_READONLY_INVARIANT_BROKEN'
  | 'FPC_DETERMINISM_BROKEN'
  | 'FPC_FREEZE_BROKEN'
  | 'FPC_TOPOLOGY_BROKEN'
  | 'FPC_CONVERGENCE_BROKEN'
  | 'FPC_CONTAINMENT_BROKEN'
  | 'FPC_CERTIFICATION_INVALID'
  | 'FPC_AGGREGATE_INCONSISTENT';

export interface FpcObject {
  readonly id: string;
  readonly layer: string;
  readonly value: number;
  readonly signature: string;
}

export interface FpcMorphism {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly weight: number;
}

export interface FpcCategory {
  readonly id: string;
  readonly objects: readonly FpcObject[];
  readonly morphisms: readonly FpcMorphism[];
  readonly signature: string;
}

export interface FpcFixedPoint {
  readonly id: string;
  readonly path: readonly string[];
  readonly iterations: number;
  readonly stable: boolean;
  readonly cycle: boolean;
  readonly diverged: boolean;
  readonly convergenceClass: FpcConvergenceClass;
}

export interface FpcResolution {
  readonly category: FpcCategory;
  readonly fixedPoints: readonly FpcFixedPoint[];
  readonly cycles: readonly (readonly string[])[];
  readonly unreachable: readonly string[];
}

export interface FpcIdentity {
  readonly identityCount: number;
  readonly missing: readonly string[];
  readonly canonical: boolean;
}

export interface FpcComposition {
  readonly associative: boolean;
  readonly closed: boolean;
  readonly violations: readonly string[];
}

export interface FpcNormalization {
  readonly signature: string;
  readonly idempotent: boolean;
  readonly mode: FpcReductionMode;
}

export interface FpcDeterminism {
  readonly stable: boolean;
  readonly signature: string;
  readonly replays: number;
}

export interface FpcEquivalence {
  readonly classes: readonly (readonly string[])[];
  readonly kind: FpcEquivalenceKind;
  readonly symmetric: boolean;
  readonly transitive: boolean;
}

export interface FpcReduction {
  readonly mode: FpcReductionMode;
  readonly steps: number;
  readonly signature: string;
}

export interface FpcTopology {
  readonly mode: FpcTopologyMode;
  readonly connectedComponents: number;
  readonly cyclic: boolean;
  readonly collapsed: boolean;
  readonly unreachable: boolean;
}

export interface FpcStability {
  readonly bounded: boolean;
  readonly oscillation: boolean;
  readonly containment: number;
}

export interface FpcCertification {
  readonly rank: FpcCertificationRank;
  readonly confidence: number;
  readonly reasons: readonly string[];
}

export interface FpcClosure {
  readonly closed: boolean;
  readonly missing: readonly string[];
  readonly signature: string;
}

export interface FpcContainment {
  readonly classification: FpcContainmentClass;
  readonly leaking: boolean;
  readonly collapsing: boolean;
  readonly depth: number;
}

export interface FpcConvergenceModel {
  readonly classification: FpcConvergenceClass;
  readonly confidence: number;
  readonly regressed: boolean;
}

export interface FpcViolation {
  readonly code: FpcViolationCode;
  readonly severity: FpcSeverity;
  readonly target: string;
  readonly description: string;
}

export interface FpcEnvelope {
  readonly id: string;
  readonly category: FpcCategory;
  readonly resolution: FpcResolution;
  readonly identity: FpcIdentity;
  readonly composition: FpcComposition;
  readonly normalization: FpcNormalization;
  readonly determinism: FpcDeterminism;
  readonly equivalence: FpcEquivalence;
  readonly reduction: FpcReduction;
  readonly topology: FpcTopology;
  readonly stability: FpcStability;
  readonly certification: FpcCertification;
  readonly closure: FpcClosure;
  readonly containment: FpcContainment;
  readonly convergence: FpcConvergenceModel;
  readonly signature: string;
}

export interface FpcAggregate {
  readonly envelopes: readonly FpcEnvelope[];
  readonly score: number;
  readonly confidence: number;
  readonly stable: boolean;
  readonly violations: readonly FpcViolation[];
  readonly signature: string;
}

export interface FpcInternals {
  readonly stage: FpcStage;
  readonly liveExecutionEnabled: false;
  readonly retryEnabled: false;
  readonly backgroundEnabled: false;
  readonly realUsersAllowed: false;
}
