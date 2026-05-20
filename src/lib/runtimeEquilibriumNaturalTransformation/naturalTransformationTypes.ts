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

export interface RuntimeNaturalTransformation { readonly components: readonly NaturalComponent[]; readonly class: NaturalClass; readonly naturality: number; readonly collapsed: boolean; readonly signature: string; }
export interface RuntimeNaturalComposition { readonly class: CompositionClass; readonly associativity: number; readonly broken: boolean; readonly failed: boolean; }
export interface RuntimeNatur