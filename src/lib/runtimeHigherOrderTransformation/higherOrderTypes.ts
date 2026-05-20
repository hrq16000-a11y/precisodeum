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
export interface RuntimeHigherOrderDeterminism { readonly class: DeterminismClass; readonly score: number; readonly degraded: boolean; }