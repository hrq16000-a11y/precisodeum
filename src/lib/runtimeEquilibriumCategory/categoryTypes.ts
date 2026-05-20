export type CategoryStabilityClass = 'IDENTITY' | 'STABLE' | 'TRANSFORMING' | 'FRACTURED' | 'COLLAPSED';
export type FunctorClass = 'PRESERVING' | 'WEAKLY_PRESERVING' | 'DISTORTING' | 'RECURSIVE' | 'DEGENERATE';
export type TransformationClass = 'NATURAL' | 'WEAK' | 'PARTIAL' | 'BROKEN' | 'NON_NATURAL';
export type MorphismsPropagation = 'ISOLATED' | 'CONTAINED' | 'DISTRIBUTED' | 'ESCALATING' | 'INFINITE';
export type CoherenceClass = 'COHERENT' | 'WEAKLY_COHERENT' | 'INCONSISTENT' | 'FRACTURED' | 'COLLAPSING';
export type CategorySeverity = 'info' | 'warn' | 'error' | 'critical';

export interface CategoryObject {
  readonly id: string;
  readonly layer: string;
  readonly stage: string;
  readonly liveExecutionEnabled: boolean;
  readonly retryEnabled: boolean;
  readonly backgroundEnabled: boolean;
  readonly realUsersAllowed: boolean;
  readonly preservation: number;
  readonly coherence: number;
  readonly identity: number;
  readonly morphisms: readonly string[];
  readonly signature: string;
}

export interface RuntimeStabilityCategory {
  readonly objects: readonly CategoryObject[];
  readonly classification: CategoryStabilityClass;
  readonly balance: number;
  readonly collapsed: boolean;
  readonly signature: string;
}

export interface RuntimeFunctorEnvelope {
  readonly class: FunctorClass;
  readonly preservation: number;
  readonly recursive: boolean;
  readonly degenerate: boolean;
}

export interface RuntimeTransformationGraph {
  readonly class: TransformationClass;
  readonly consistency: number;
  readonly broken: boolean;
  readonly nonNatural: boolean;
}

export interface RuntimePropagationMorphisms {
  readonly propagation: MorphismsPropagation;
  readonly length: number;
  readonly containment: number;
  readonly recursive: boolean;
  readonly infinite: boolean;
}

export interface RuntimeCoherenceEnvelope {
  readonly class: CoherenceClass;
  readonly balance: number;
  readonly inconsistent: boolean;
  readonly collapsing: boolean;
}

export interface RuntimeEquivalenceRelation {
  readonly strength: number;
  readonly fractured: boolean;
  readonly recursive: boolean;
}

export interface RuntimeIdentityEnvelope {
  readonly preservation: number;
  readonly violations: number;
  readonly normalized: boolean;
}

export interface RuntimeCompositionEnvelope {
  readonly equilibrium: number;
  readonly unstable: boolean;
  readonly fractured: boolean;
}

export interface RuntimeFunctorialCollapse {
  readonly collapsing: boolean;
  readonly recursive: boolean;
  readonly irrecoverable: boolean;
  readonly containment: number;
}

export interface CategoryRisk {
  readonly code: string;
  readonly severity: CategorySeverity;
  readonly description: string;
}

export interface CategoryCertification {
  readonly safe: boolean;
  readonly confidence: number;
  readonly rank: 'OK' | 'WARN' | 'BLOCKED';
  readonly reasons: readonly string[];
}

export interface RuntimeCategoryEnvelope {
  readonly id: string;
  readonly category: RuntimeStabilityCategory;
  readonly functor: RuntimeFunctorEnvelope;
  readonly transformation: RuntimeTransformationGraph;
  readonly morphisms: RuntimePropagationMorphisms;
  readonly coherence: RuntimeCoherenceEnvelope;
  readonly equivalence: RuntimeEquivalenceRelation;
  readonly identity: RuntimeIdentityEnvelope;
  readonly composition: RuntimeCompositionEnvelope;
  readonly collapse: RuntimeFunctorialCollapse;
  readonly certification: CategoryCertification;
  readonly risks: readonly CategoryRisk[];
  readonly score: number;
  readonly stable: boolean;
}

export interface RuntimeCategoryAggregate {
  readonly envelopes: readonly RuntimeCategoryEnvelope[];
  readonly score: number;
  readonly confidence: number;
  readonly worstSeverity: CategorySeverity;
  readonly worstCategory: CategoryStabilityClass;
  readonly worstFunctor: FunctorClass;
  readonly worstTransformation: TransformationClass;
  readonly worstMorphisms: MorphismsPropagation;
  readonly worstCoherence: CoherenceClass;
  readonly stable: boolean;
  readon