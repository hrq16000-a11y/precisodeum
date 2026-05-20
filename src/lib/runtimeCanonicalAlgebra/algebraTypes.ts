/**
 * Phase 1.9.0 — Runtime Canonical Algebra + Deterministic State Graph.
 *
 * 100% read-only, deterministic, side-effect free, reversible.
 * No runtime imports. No I/O. No hooks. No timers.
 */

export const CANONICAL_LAYERS = [
  'recorder',
  'history',
  'replay',
  'causality',
  'stability',
  'integrity',
  'isolation',
  'enforcement',
  'immutable-core',
  'mesh',
  'certification',
  'governance',
  'promotion',
  'pilot',
] as const;

export type CanonicalLayer = (typeof CANONICAL_LAYERS)[number];

export type RuntimeAlgebraSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type RuntimeCanonicalStateClass =
  | 'canonical'
  | 'normalized'
  | 'reducible'
  | 'irreducible'
  | 'unstable'
  | 'divergent';

export type RuntimeTransitionMode =
  | 'deterministic'
  | 'equivalent'
  | 'degraded'
  | 'unstable'
  | 'recursive'
  | 'impossible';

export type RuntimeEquivalenceClass =
  | 'strict'
  | 'structural'
  | 'behavioral'
  | 'partial'
  | 'invalid';

export type RuntimeReductionMode =
  | 'fully_reduced'
  | 'partially_reduced'
  | 'irreducible'
  | 'unstable'
  | 'recursive';

export type RuntimeDeterminismLevel =
  | 'strict'
  | 'stable'
  | 'eventual'
  | 'unstable'
  | 'divergent';

export type RuntimeNormalizationMode =
  | 'canonical'
  | 'normalized'
  | 'conflicted'
  | 'failed';

export type RuntimeCanonicalViolationCode =
  | 'ALGEBRA_INVARIANT_BROKEN'
  | 'ALGEBRA_NONDETERMINISTIC'
  | 'ALGEBRA_COMPOSITION_CONFLICT'
  | 'ALGEBRA_REDUCTION_FAILED'
  | 'ALGEBRA_EQUIVALENCE_INVALID'
  | 'ALGEBRA_TOPOLOGY_RECURSIVE'
  | 'ALGEBRA_TRANSITION_IMPOSSIBLE'
  | 'ALGEBRA_CERTIFICATION_INVALID'
  | 'ALGEBRA_NORMALIZATION_FAILED';

export interface RuntimeState {
  readonly id: string;
  readonly layer: CanonicalLayer;
  readonly stage: string;
  readonly liveExecutionEnabled: boolean;
  readonly retryEnabled: boolean;
  readonly backgroundEnabled: boolean;
  readonly realUsersAllowed: boolean;
  readonly classification: RuntimeCanonicalStateClass;
  readonly attributes: Readonly<Record<string, string | number | boolean>>;
}

export interface RuntimeNode {
  readonly id: string;
  readonly layer: CanonicalLayer;
  readonly state: RuntimeState;
  readonly inDegree: number;
  readonly outDegree: number;
  readonly orphan: boolean;
  readonly redundant: boolean;
  readonly recursive: boolean;
}

export interface RuntimeEdge {
  readonly from: string;
  readonly to: string;
  readonly mode: RuntimeTransitionMode;
  readonly weight: number; // 0..1
  readonly recursive: boolean;
}

export interface RuntimeTransition {
  readonly from: string;
  readonly to: string;
  readonly mode: RuntimeTransitionMode;
  readonly possible: boolean;
  readonly deterministic: boolean;
  readonly regression: boolean;
}

export interface RuntimeComposition {
  readonly composed: readonly string[]; // node ids
  readonly conflicts: readonly { readonly a: string; readonly b: string; readonly reason: string }[];
  readonly explosion: boolean;
  readonly classification: 'safe' | 'overcomposed' | 'recursive' | 'conflicting' | 'unstable';
}

export interface RuntimeEquivalence {
  readonly classes: readonly {
    readonly id: string;
    readonly members: readonly string[];
    readonly kind: RuntimeEquivalenceClass;
  }[];
  readonly falseEquivalences: readonly { readonly a: string; readonly b: string }[];
}

export interface RuntimeDeterminism {
  readonly level: RuntimeDeterminismLevel;
  readonly varianceCount: number;
  readonly nonDeterministicNodes: readonly string[];
  readonly temporalInstability: boolean;
}

export interface RuntimeReduction {
  readonly mode: RuntimeReductionMode;
  readonly originalNodes: number;
  readonly reducedNodes: number;
  readonly gain: number; // 0..1
  readonly equivalenceMismatch: boolean;
}

export interface RuntimeNormalization {
  readonly mode: RuntimeNormalizationMode;
  readonly canonicalHash: string;
  readonly conflicts: readonly string[];
}

export interface RuntimeClassification {
  readonly stateClass: RuntimeCanonicalStateClass;
  readonly topology: 'stable' | 'overlapping' | 'recursive' | 'circular' | 'collapsed';
  readonly determinism: RuntimeDeterminismLevel;
}

export interface RuntimeAlgebraTopology {
  readonly state: RuntimeClassification['topology'];
  readonly cycles: readonly (readonly string[])[];
  readonly recursive: boolean;
  readonly collapsed: boolean;
}

export interface RuntimeCanonicalInvariant {
  readonly name: string;
  readonly satisfied: boolean;
  readonly violators: readonly string[];
}

export interface RuntimeCanonicalCertification {
  readonly level: 'full' | 'partial' | 'conditional' | 'blocked';
  readonly graphOk: boolean;
  readonly determinismOk: boolean;
  readonly equivalenceOk: boolean;
  readonly normalizationOk: boolean;
  readonly reductionOk: boolean;
  readonly confidence: number;
  readonly reasons: readonly string[];
}

export interface RuntimeCanonicalEnvelope {
  readonly sealed: boolean;
  readonly invariants: readonly RuntimeCanonicalInvariant[];
  readonly violators: readonly string[];
}

export interface RuntimeAlgebraViolation {
  readonly code: RuntimeCanonicalViolationCode;
  readonly severity: RuntimeAlgebraSeverity;
  readonly nodes: readonly string[];
  readonly message: string;
}

export interface RuntimeAlgebraRisk {
  readonly id: string;
  readonly severity: RuntimeAlgebraSeverity;
  readonly description: string;
  readonly nodes: readonly string[];
}

export interface RuntimeAlgebraHealth {
  readonly score: number;
  readonly status: 'healthy' | 'degraded' | 'unstable' | 'collapsed';
  readonly violationCount: number;
  readonly criticalViolations: number;
}

export interface CanonicalRuntimeGraph {
  readonly generatedAt: string;
  readonly nodes: readonly RuntimeNode[];
  readonly edges: readonly RuntimeEdge[];
  readonly states: readonly RuntimeState[];
  readonly transitions: readonly RuntimeTransition[];
  readonly composition: RuntimeComposition;
  readonly equivalence: RuntimeEquivalence;
  readonly determinism: RuntimeDeterminism;
  readonly reduction: RuntimeReduction;
  readonly normalization: RuntimeNormalization;
  readonly classification: RuntimeClassification;
  readonly topology: RuntimeAlgebraTopology;
  readonly envelope: RuntimeCanonicalEnvelope;
  readonly certification: RuntimeCanonicalCertification;
  readonly violations: readonly RuntimeAlgebraViolation[];
  readonly risks: readonly RuntimeAlgebraRisk[];
  readonly health: RuntimeAlgebraHealth;
  readonly readOnly: true;
}

export interface RuntimeAlgebraAggregation {
  readonly graph: CanonicalRuntimeGraph;
  readonly integrityScore: number;
  readonly confidence: number;
  readonly summary: string;
}
