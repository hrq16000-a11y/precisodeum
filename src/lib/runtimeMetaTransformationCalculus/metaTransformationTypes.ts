// Phase 1.9.10 — Runtime Meta-Transformation Calculus · Types
// Pure structural types. Read-only. Deterministic.

export type MetaClass = 'META' | 'WEAKLY_META' | 'PARTIAL' | 'BROKEN' | 'DEGENERATE';
export type MetaCompositionClass = 'ASSOCIATIVE' | 'WEAK' | 'PARTIAL' | 'BROKEN' | 'NON_ASSOCIATIVE';
export type MetaIdentityClass = 'PRESERVED' | 'WEAK' | 'BROKEN';
export type MetaNormalizationClass = 'IDEMPOTENT' | 'STABLE' | 'UNSTABLE' | 'DIVERGENT';
