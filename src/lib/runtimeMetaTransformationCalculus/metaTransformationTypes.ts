export type MetaClass = 'META' | 'WEAKLY_META' | 'PARTIAL' | 'BROKEN' | 'DEGENERATE';
export type CompositionClass = 'ASSOCIATIVE' | 'WEAK' | 'PARTIAL' | 'BROKEN' | 'NON_ASSOCIATIVE';
export type IdentityClass = 'PRESERVED' | 'WEAK' | 'BROKEN';
export type NormalizationClass = 'IDEMPOTENT' | 'STABLE' | 'UNSTABLE' | 'DIVERGENT';
export type DeterminismClass = 'DETERMINISTIC' | 'WEAK' | 'NONDETERMINISTIC';
export type EquivalenceClass = 'EQUIVALENT' | 'WEAK' | 'REGRESSED' | 'FRACTURED';
export type ReductionClass = 'IDEMPOTENT' | 'STABLE' | 'UNSTABLE';
export type TopologyClass = 'STABLE' | 'WEAK' | '