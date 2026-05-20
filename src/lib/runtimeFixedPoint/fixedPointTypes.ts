/**
 * Fase 1.9.1 — Fixed-Point types (READ-ONLY, serializable).
 */

export type FixedPointClass =
  | 'stable'
  | 'convergent'
  | 'recursive'
  | 'divergent'
  | 'unstable'
  | 'impossible';

export type FixedPointConvergenceMode =
  | 'strict'
  | 'deterministic'
  | 'eventual'
  | 'unstable'
  | 'divergent';

export type FixedPointTopologyMode =
  | 'stable'
  | 'oscillating'
  | 'recursive'
  | 'collapsing'
  | 'unreachable';

export type FixedPointPropagationMode =
  | 'bounded'
  | 'recursive'
  | 'overflow'
  | 'infinite'
  | 'stable';

export type FixedPointRecursionMode =
  | 'bounded'
  | 'equivalent'
  | 'unbounded'
  | 'collapsed';

export type FixedPointNormalizationMode =
  | 'stable'
  | 'idempotent'
  | 'oscillating'
  | 'unstable';

export type FixedPointSeverity = 'info' | 'warn' | 'error' | 'critical';

export type FixedPointViolationCode =
  | 'FIXED_POINT_DIVERGENCE'
  | 'FIXED_POINT_OSCILLATION'
  | 'FIXED_POINT_PROPAGATION_OVERFLOW'
  | 'FIXED_POINT_RECURSION_UNBOUNDED'
  | 'FIXED_POINT_NORMALIZATION_UNSTABLE'
  | 'FIXED_POINT_TOPOLOGY_COLLAPSED'
  | 'FIXED_POINT_CERTIFICATION_INVALID'
  | 'FIXED_POINT_READONLY_INVARIANT_BROKEN';

export interface FixedPointState {
  readonly id: string;
  readonly layer: string;
  readonly stage: string;
  readonly liveExecutionEnabled: boolean;
  readonly retryEnabled: boolean;
  readonly backgroundEnabled: boolean;
  readonly realUsersAllowed: boolean;
  readonly signature: string;
}

export interface RuntimeFixedPoint {
  readonly id: string;
  readonly states: readonly FixedPointState[];
  readonly class: FixedPointClass;
  readonly iterations: number;
  readonly stable: boolean;
}

export interface FixedPointResolution {
  readonly fixedPoints: readonly RuntimeFixedPoint[];
  readonly loops: readonly string[];
  readonly unstable: readonly string[];
  readonly impossible: readonly string[];
}

export interface FixedPointConvergence {
  readonly mode: FixedPointConvergenceMode;
  readonly confidence: number;
  readonly regressed: boolean;
  readonly asymptoticallyStable: boolean;
}

export interface FixedPointTopology {
  readonly mode: FixedPointTopologyMode;
  readonly oscillating: boolean;
  readonly recursive: boolean;
  readonly collapsed: boolean;
  readonly unreachable: boolean;
}

export interface FixedPointEquivalence {
  readonly classes: readonly (readonly string[])[];
  readonly kind: 'exact' | 'structural' | 'convergent' | 'recursive' | 'invalid';
  readonly falseConvergence: boolean;
}

export interface FixedPointRecursion {
  readonly mode: FixedPointRecursionMode;
  readonly depth: number;
  readonly bounded: boolean;
}

export interface FixedPointPropagation {
  readonly mode: FixedPointPropagationMode;
  readonly overflow: boolean;
  readonly infinite: boolean;
  readonly bounded: boolean;
}

export interface FixedPointNormalization {
  readonly mode: FixedPointNormalizationMode;
  readonly idempotent: boolean;
  readonly oscillating: boolean;
  readonly signature: string;
}

export interface FixedPointCertification {
  readonly rank: 'FULL' | 'PARTIAL' | 'CONDITIONAL' | 'BLOCKED';
  readonly confidence: number;
  readonly reasons: readonly string[];
}

export interface FixedPointRisk {
  readonly code: FixedPointViolationCode;
  readonly severity: FixedPointSeverity;
  readonly description: string;
}

export interface FixedPointHealth {
  readonly score: number;
  readonly stable: boolean;
  readonly risks: readonly FixedPointRisk[];
}

export interface FixedPointEnvelope {
  readonly id: string;
  readonly resolution: FixedPointResolution;
  readonly convergence: FixedPointConvergence;
  readonly topology: FixedPointTopology;
  readonly equivalence: FixedPointEquivalence;
  readonly recursion: FixedPointRecursion;
  readonly propagation: FixedPointPropagation;
  readonly normalization: FixedPointNormalization;
  readonly certification: FixedPointCertification;
  readonly health: FixedPointHealth;
}

export interface FixedPointAggregation {
  readonly envelopes: readonly FixedPointEnvelope[];
  readonly score: number;
  readonly confidence: number;
  readonly complexity: number;
  readonly stable: boolean;
  readonly risks: readonly FixedPointRisk[];
}
