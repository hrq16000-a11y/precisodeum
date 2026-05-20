// Phase 1.9.10 — Runtime Meta-Transformation Calculus · Types
// Pure structural types. Read-only. Deterministic.

export type MetaClass = 'META' | 'WEAKLY_META' | 'PARTIAL' | 'BROKEN' | 'DEGENERATE';
export type MetaCompositionClass = 'ASSOCIATIVE' | 'WEAK' | 'PARTIAL' | 'BROKEN' | 'NON_ASSOCIATIVE';
export type MetaIdentityClass = 'PRESERVED' | 'WEAK' | 'BROKEN';
export type MetaNormalizationClass = 'IDEMPOTENT' | 'STABLE' | 'UNSTABLE' | 'DIVERGENT';
export type MetaDeterminismClass = 'DETERMINISTIC' | 'WEAK' | 'NONDETERMINISTIC';
export type MetaEquivalenceClass = 'EQUIVALENT' | 'WEAK' | 'REGRESSED' | 'FRACTURED';
export type MetaReductionClass = 'IDEMPOTENT' | 'STABLE' | 'UNSTABLE';
export type MetaTopologyClass = 'STABLE' | 'WEAK' | 'UNSTABLE' | 'COLLAPSED';
export type MetaStabilityClass = 'STABLE' | 'WEAK' | 'UNSTABLE' | 'COLLAPSED';
export type MetaNaturalityClass = 'NATURAL' | 'WEAK' | 'PARTIAL' | 'BROKEN';
export type MetaFunctorialityClass = 'FUNCTORIAL' | 'WEAK' | 'PARTIAL' | 'FAILED';
export type MetaLiftingClass = 'LIFTED' | 'WEAK' | 'PARTIAL' | 'UNLIFTABLE';
export type MetaFixedPointClass = 'FIXED' | 'CONVERGENT' | 'OSCILLATING' | 'DIVERGENT';
export type MetaSeverity = 'info' | 'warn' | 'error' | 'critical';

export interface MetaComponent {
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
  readonly fixedPoint: number;
  readonly morphisms: readonly string[];
  readonly signature: string;
}

export interface RuntimeMetaTransformation {
  readonly components: readonly MetaComponent[];
  readonly class: MetaClass;
  readonly score: number;
  readonly collapsed: boolean;
  readonly signature: string;
}
export interface RuntimeMetaComposition { readonly class: MetaCompositionClass; readonly associativity: number; readonly broken: boolean; readonly failed: boolean; }
export interface RuntimeMetaIdentity { readonly class: MetaIdentityClass; readonly preservation: number; readonly violations: number; readonly broken: boolean; }
export interface RuntimeMetaNormalization { readonly class: MetaNormalizationClass; readonly stability: number; readonly idempotent: boolean; readonly divergent: boolean; }
export interface RuntimeMetaDeterminism { readonly class: MetaDeterminismClass; readonly score: number; readonly degraded: boolean; }
export interface RuntimeMetaEquivalence { readonly class: MetaEquivalenceClass; readonly strength: number; readonly regressed: boolean; readonly fractured: boolean; }
export interface RuntimeMetaReduction { readonly class: MetaReductionClass; readonly idempotent: boolean; readonly score: number; }
export interface RuntimeMetaTopology { readonly class: MetaTopologyClass; readonly connectivity: number; readonly unstable: boolean; readonly collapsed: boolean; }
export interface RuntimeMetaStability { readonly class: MetaStabilityClass; readonly score: number; readonly unstable: boolean; readonly collapsed: boolean; }
export interface RuntimeMetaNaturality { readonly class: MetaNaturalityClass; readonly score: number; readonly violations: number; readonly broken: boolean; }
export interface RuntimeMetaFunctoriality { readonly class: MetaFunctorialityClass; readonly score: number; readonly failed: boolean; }
export interface RuntimeMetaLifting { readonly class: MetaLiftingClass; readonly score: number; readonly unliftable: boolean; }
export interface RuntimeMetaFixedPoint { readonly class: MetaFixedPointClass; readonly score: number; readonly converged: boolean; readonly divergent: boolean; }
export interface MetaRisk { readonly code: string; readonly severity: MetaSeverity; readonly description: string; }
export interface MetaCertification { readonly safe: boolean; readonly confidence: number; readonly rank: 'OK' | 'WARN' | 'BLOCKED'; readonly reasons: readonly string[]; }

