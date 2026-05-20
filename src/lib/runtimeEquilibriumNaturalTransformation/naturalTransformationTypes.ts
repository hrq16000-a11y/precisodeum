export type NaturalClass = 'NATURAL' | 'WEAKLY_NATURAL' | 'PARTIAL' | 'BROKEN' | 'DEGENERATE';
export type CompositionClass = 'ASSOCIATIVE' | 'WEAK' | 'PARTIAL' | 'BROKEN' | 'NON_ASSOCIATIVE';
export type IdentityClass = 'PRESERVED' | 'WEAK' | 'BROKEN';
export type NormalizationClass = 'IDEMPOTENT' | 'STABLE' | 'UNSTABLE' | 'DIVERGENT';
export type DeterminismClass = 'DETERMINISTIC' | 'WEAK' | 'NONDETERMINISTIC';
export type EquivalenceClass = 'EQUIVALENT' | 'WEAK' | 'REGRESSED' | 'FRACTURED';
export type ReductionClass = 'IDEMPOTENT' | 'STABLE' | 'UNSTABLE';
export type TopologyClass = 'STABLE' | 'WEAK' | 'UNSTABLE' | 'COLLAPSED';
export type StabilityClass = 'STABLE' | 'WEAK' | 'UNSTABLE' | 'COLLAPSED';
export type DiagramClass = 'COMMUTATIVE' | 'WEAK' | 'PARTIAL' | 'BROKEN';
export type NaturalitySeverity = 'info' | 'warn' | 'error' | 'critical';

export interface NaturalComponent {
  readonly id: string;
  readonly layer: string;
  readonly stage: string;
  readonly liveExecutionEnabled: boolean;
  readonly retryEnabled: boolean;
  readonly backgroundEnabled: boolean;
  readonly realUsersAllowed: boolean;
  readonly naturality: number;
  readonly identity: number;
  readonly determinism: number;
  readonly stability: number;
  readonly commutativity: number;
  readonly morphisms: readonly string[];
  readonly signature: string;
}

export interface RuntimeNaturalTransformation {
  readonly components: readonly NaturalComponent[];
  readonly class: NaturalClass;
  readonly naturality: number;
  readonly collapsed: boolean;
  readonly signature: string;
}
export interface RuntimeNaturalComposition {
  readonly class: CompositionClass;
  readonly associativity: number;
  readonly broken: boolean;
  readonly failed: boolean;
}
export interface RuntimeNaturalIdentity {
  readonly class: IdentityClass;
  readonly preservation: number;
  readonly violations: number;
  readonly broken: boolean;
}
export interface RuntimeNaturalNormalization {
  readonly class: NormalizationClass;
  readonly stability: number;
  readonly idempotent: boolean;
  readonly divergent: boolean;
}
export interface RuntimeNaturalDeterminism {
  readonly class: DeterminismClass;
  readonly score: number;
  readonly degraded: boolean;
}
export interface RuntimeNaturalEquivalence {
  readonly class: EquivalenceClass;
  readonly strength: number;
  readonly regressed: boolean;
  readonly fractured: boolean;
}
export interface RuntimeNaturalReduction {
  readonly class: ReductionClass;
  readonly idempotent: boolean;
  readonly score: number;
}
export interface RuntimeNaturalTopology {
  readonly class: TopologyClass;
  readonly connectivity: number;
  readonly unstable: boolean;
  readonly collapsed: boolean;
}
export interface RuntimeNaturalStability {
  readonly class: StabilityClass;
  readonly score: number;
  readonly unstable: boolean;
  readonly collapsed: boolean;
}
export interface RuntimeCommutativeDiagram {
  readonly class: DiagramClass;
  readonly commutativity: number;
  readonly failed: boolean;
}
export interface RuntimeNaturalityConditions {
  readonly satisfied: boolean;
  readonly score: number;
  readonly violations: number;
}

export interface NaturalityRisk { readonly code: string; readonly severity: NaturalitySeverity; readonly description: string; }
export interface NaturalCertification { readonly safe: boolean; readonly confidence: number; readonly rank: 'OK' | 'WARN' | 'BLOCKED'; readonly reasons: readonly string[]; }

export interface RuntimeNaturalEnvelope {
  readonly id: string;
  readonly transformation: RuntimeNaturalTransformation;
  readonly composition: RuntimeNaturalComposition;
  readonly identity: RuntimeNaturalIdentity;
  readonly normalization: RuntimeNaturalNormalization;
  readonly determinism: RuntimeNaturalDeterminism;
  readonly equivalence: RuntimeNaturalEquivalence;
  readonly reduction: RuntimeNaturalReduction;
  readonly topology: RuntimeNaturalTopology;
  readonly stability: RuntimeNaturalStability;
  readonly diagram: RuntimeCommutativeDiagram;
  readonly naturalityConditions: RuntimeNaturalityConditions;
  readonly certification: NaturalCertification;
  readonly risks: readonly NaturalityRisk[];
  readonly score: number;
  readonly stable: boolean;
}

export interface RuntimeNaturalAggregate {
  readonly envelopes: readonly RuntimeNaturalEnvelope[];
  readonly score: number;
  readonly confidence: number;
  readonly worstSeverity: NaturalitySeverity;
  readonly worstNatural: NaturalClass;
  readonly worstComposition: CompositionClass;
  readonly worstIdentity: IdentityClass;
  readonly worstDeterminism: DeterminismClass;
  readonly worstTopology: TopologyClass;
  readonly worstDiagram: DiagramClass;
  readonly stable: boolean;
  readonly risks: readonly NaturalityRisk[];
}
