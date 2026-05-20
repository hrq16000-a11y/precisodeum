// Phase 1.9.10 — Runtime Meta-Transformation Calculus · Types
// Pure structural types. Read-only. Deterministic. No IO, no runtime, no mutation.

export type MetaClass = 'META' | 'WEAKLY_META' | 'PARTIAL' | 'BROKEN' | 'DEGENERATE';
export type MetaCompositionClass = 'ASSOCIATIVE' | 'WEAK' | 'PARTIAL' | 'BROKEN' | 'NON_ASSOCIATIVE';
export type MetaIdentityClass = 'PRESERVED' | 'WEAK' | 'BROKEN';
export type MetaNormalizationClass = 'IDEMPOTENT' | 'STABLE' | 'UNSTABLE' | 'DIVERGENT';
export type MetaDeterminismClass = 'DETERMINISTIC' | 'WEAK' | 'NONDETERMINISTIC';
export type MetaEquivalenceClass = 'EQUIVALENT' | 'WEAK' | 'REGRESSED' | 'FRACTURED';
export type MetaReductionClass = 'IDEMPOTENT' | 'STABLE' | 'UNSTABLE';
export type MetaTopologyClass = 'STABLE' | 'WEAK' | 'UNSTABLE' | 'COLLAPSED';
export type MetaStabilityClass = 'STABLE' | 'WEAK' | 'UNSTABLE' | 'COLLAPSED';
export type MetaNaturalityClass = 'NATURAL' | '