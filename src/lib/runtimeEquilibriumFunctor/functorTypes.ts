export type FunctorClass = 'PRESERVING' | 'WEAKLY_PRESERVING' | 'DISTORTING' | 'RECURSIVE' | 'DEGENERATE';
export type CompositionClass = 'ASSOCIATIVE' | 'WEAK' | 'PARTIAL' | 'BROKEN' | 'NON_ASSOCIATIVE';
export type IdentityClass = 'PRESERVED' | 'WEAK' | 'BROKEN';
export type NormalizationClass = 'IDEMPOTENT' | 'STABLE' | 'UNSTABLE' | 'DIVERGENT';
export type DeterminismClass = 'DETERMINISTIC' | 'WEAK' | 'NONDETERMINISTIC';
export type EquivalenceClass = 'EQUIVALENT' | 'WEAK' | 'REGRESSED' | 'FRACTURED';
export type ReductionClass = 'IDEMPOTENT' | 'STABLE' | 'UNSTABLE';
export type TopologyClass = 'STABLE' | 'WEAK' | 'UNSTABLE' | 'COLLAPSED';
export type StabilityClass = 'STABLE' | 'WEAK' | 'UNSTABLE' | 'COLLAPSED';
export type FunctorSeverity = 'info' | 'warn' | 'error' | 'critical';

export interface FunctorObject {
  readonly id: string;
  readonly layer: string;
  readonly stage: string;
  readonly liveExecutionEnabled: boolean;
  readonly retryEnabled: boolean;
  readonly backgroundEnabled: boolean;
  readonly realUsersAllowed: boolean;
  readonly preservation: number;
  readonly identity: number;
  readonly determinism: number;
  readonly stability: number;
  readonly morphisms: readonly string[];
  readonly signature: string;
}

export interface RuntimeEquilibriumFunctor { readonly objects: readonly FunctorObject[]; readonly class: FunctorClass; readonly preservation: number; readonly collapsed: boolean; readonly signature: string; }
export interface RuntimeFunctorComposition { readonly class: CompositionClass; readonly associativity: number; readonly broken: boolean; readonly failed: boolean; }
export interface RuntimeFunctorIdentity { readonly class: IdentityClass; readonly preservation: number; readonly violations: number; readonly broken: boolean; }
export interface RuntimeFunctorNormalization { readonly class: NormalizationClass; readonly stability: number; readonly idempotent: boolean; readonly divergent: boolean; }
export interface RuntimeFunctorDeterminism { readonly class: DeterminismClass; readonly score: number; readonly degraded: boolean; }
export interface RuntimeFunctorEquivalence { readonly class: EquivalenceClass; readonly strength: number; readonly regressed: boolean; readonly fractured: boolean; }
export interface RuntimeFunctorReduction { readonly class: ReductionClass; readonly idempotent: boolean; readonly score: number; }
export interface RuntimeFunctorTopology { readonly class: TopologyClass; readonly connectivity: number; readonly unstable: boolean; readonly collapsed: boolean; }
export interface RuntimeFunctorStability { readonly class: StabilityClass; readonly score: number; readonly unstable: boolean; readonly collapsed: boolean; }

export interface FunctorRisk { readonly code: string; readonly severity: FunctorSeverity; readonly description: string; }
export interface FunctorCertification { readonly safe: boolean; readonly confidence: number; readonly rank: 'OK' | 'WARN' | 'BLOCKED'; readonly reasons: readonly string[]; }

export interface RuntimeFunctorEnvelope {
  readonly id: string;
  readonly functor: RuntimeEquilibriumFunctor;
  readonly composition: RuntimeFunctorComposition;
  readonly identity: RuntimeFunctorIdentity;
  readonly normalization: RuntimeFunctorNormalization;
  readonly determinism: RuntimeFunctorDeterminism;
  readonly equivalence: RuntimeFunctorEquivalence;
  readonly reduction: RuntimeFunctorReduction;
  readonly topology: RuntimeFunctorTopology;
  readonly stability: RuntimeFunctorStability;
  readonly certification: FunctorCertification;
  readonly risks: readonly FunctorRisk[];
  readonly score: number;
  readonly stable: boolean;
}

export interface RuntimeFunctorAggregate {
  readonly envelopes: readonly RuntimeFunctorEnvelope[];
  readonly score: number;
  readonly confidence: number;
  readonly worstSeverity: FunctorSeverity;
  readonly worstFunctor: FunctorClass;
  readonly worstComposition: CompositionClass;
  readonly worstIdentity: IdentityClass;
  readonly worstDeterminism: DeterminismClass;
  readonly worstTopology: TopologyClass;
  readonly stable: boolean;
  readonly risks: readonly FunctorRisk[];
}
