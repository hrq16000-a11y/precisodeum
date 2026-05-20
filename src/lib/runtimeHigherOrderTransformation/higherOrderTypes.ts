export type HigherOrderClass = 'HIGHER_ORDER' | 'WEAKLY_HIGHER' | 'PARTIAL' | 'BROKEN' | 'DEGENERATE';
export type CompositionClass = 'ASSOCIATIVE' | 'WEAK' | 'PARTIAL' | 'BROKEN' | 'NON_ASSOCIATIVE';
export type IdentityClass = 'PRESERVED' | 'WEAK' | 'BROKEN';
export type NormalizationClass = 'IDEMPOTENT' | 'STABLE' | 'UNSTABLE' | 'DIVERGENT';
export type DeterminismClass = 'DETERMINISTIC' | 'WEAK' | 'NONDETERMINISTIC';
export type EquivalenceClass = 'EQUIVALENT' | 'WEAK' | 'REGRESSED' | 'FRACTURED';
export type ReductionClass = 'IDEMPOTENT' | 'STABLE' | 'UNSTABLE';
export type TopologyClass = 'STABLE' | 'WEAK' | 'UNSTABLE' | 'COLLAPSED';
export type StabilityClass = 'STABLE' | 'WEAK' | 'UNSTABLE' | 'COLLAPSED';
export type NaturalityClass = 'NATURAL' | 'WEAK' | 'PARTIAL' | 'BROKEN';
export type FunctorialityClass = 'FUNCTORIAL' | 'WEAK' | 'PARTIAL' | 'FAILED';
export type LiftingClass = 'LIFTED' | 'WEAK' | 'PARTIAL' | 'UNLIFTABLE';
export type HigherOrderSeverity = 'info' | 'warn' | 'error' | 'critical';

export interface HigherOrderComponent {
  readonly id: string;
  readonly layer: string;
  readonly stage: string;
  readonly liveExecutionEnabled: boolean;
  readonly retryEnabled: boolean;
  readonly backgroundEnabled: boolean;
  readonly realUsersAllowed: boolean;
  readonly naturality: number;
  readonly functoriality: number;
  readonly identity: number;
  readonly determinism: number;
  readonly stability: number;
  readonly lift: number;
  readonly morphisms: readonly string[];
  readonly signature: string;
}

export interface RuntimeHigherOrderTransformation {
  readonly components: readonly HigherOrderComponent[];
  readonly class: HigherOrderClass;
  readonly score: number;
  readonly collapsed: boolean;
  readonly signature: string;
}
export interface RuntimeHigherOrderComposition { readonly class: CompositionClass; readonly associativity: number; readonly broken: boolean; readonly failed: boolean; }
export interface RuntimeHigherOrderIdentity { readonly class: IdentityClass; readonly preservation: number; readonly violations: number; readonly broken: boolean; }
export interface RuntimeHigherOrderNormalization { readonly class: NormalizationClass; readonly stability: number; readonly idempotent: boolean; readonly divergent: boolean; }
export interface RuntimeHigherOrderDeterminism { readonly class: DeterminismClass; readonly score: number; readonly degraded: boolean; }export interface RuntimeHigherOrderEquivalence { readonly class: EquivalenceClass; readonly strength: number; readonly regressed: boolean; readonly fractured: boolean; }
export interface RuntimeHigherOrderReduction { readonly class: ReductionClass; readonly idempotent: boolean; readonly score: number; }
export interface RuntimeHigherOrderTopology { readonly class: TopologyClass; readonly connectivity: number; readonly unstable: boolean; readonly collapsed: boolean; }
export interface RuntimeHigherOrderStability { readonly class: StabilityClass; readonly score: number; readonly unstable: boolean; readonly collapsed: boolean; }
export interface RuntimeHigherOrderNaturality { readonly class: NaturalityClass; readonly score: number; readonly violations: number; readonly broken: boolean; }
export interface RuntimeHigherOrderFunctoriality { readonly class: FunctorialityClass; readonly score: number; readonly failed: boolean; }
export interface RuntimeTransformationLifting { readonly class: LiftingClass; readonly score: number; readonly unliftable: boolean; }

export interface HigherOrderRisk { readonly code: string; readonly severity: HigherOrderSeverity; readonly description: string; }
export interface HigherOrderCertification { readonly safe: boolean; readonly confidence: number; readonly rank: 'OK' | 'WARN' | 'BLOCKED'; readonly reasons: readonly string[]; }

export interface RuntimeHigherOrderEnvelope {
  readonly id: string;
  readonly transformation: RuntimeHigherOrderTransformation;
  readonly composition: RuntimeHigherOrderComposition;
  readonly identity: RuntimeHigherOrderIdentity;
  readonly normalization: RuntimeHigherOrderNormalization;
  readonly determinism: RuntimeHigherOrderDeterminism;
  readonly equivalence: RuntimeHigherOrderEquivalence;
  readonly reduction: RuntimeHigherOrderReduction;
  readonly topology: RuntimeHigherOrderTopology;
  readonly stability: RuntimeHigherOrderStability;
  readonly naturality: RuntimeHigherOrderNaturality;
  readonly functoriality: RuntimeHigherOrderFunctoriality;
  readonly lifting: RuntimeTransformationLifting;
  readonly certification: HigherOrderCertification;
  readonly risks: readonly HigherOrderRisk[];
  readonly score: number;
  readonly stable: boolean;
}

export interface RuntimeHigherOrderAggregate {
  readonly envelopes: readonly RuntimeHigherOrderEnvelope[];
  readonly score: number;
  readonly confidence: number;
  readonly worstSeverity: HigherOrderSeverity;
  readonly worstHigherOrder: HigherOrderClass;
  readonly worstComposition: CompositionClass;
  readonly worstIdentity: IdentityClass;
  readonly worstDeterminism: DeterminismClass;
  readonly worstTopology: TopologyClass;
  readonly worstNaturality: NaturalityClass;
  readonly worstFunctoriality: FunctorialityClass;
  readonly worstLifting: LiftingClass;
  readonly stable: boolean;
  readonly risks: readonly HigherOrderRisk[];
}
