/**
 * Fase 1.9.2 — Convergence Calculus types (READ-ONLY, deeply immutable).
 */

export type ConvergenceClass =
  | 'STABLE'
  | 'EVENTUAL'
  | 'OSCILLATING'
  | 'DIVERGENT'
  | 'COLLAPSING';

export type ResolutionTerminality =
  | 'TERMINAL'
  | 'NON_TERMINAL'
  | 'CYCLIC'
  | 'SATURATED'
  | 'UNRESOLVED';

export type MonotonicityClass = 'STRICT' | 'WEAK' | 'BROKEN' | 'REVERSING';

export type SaturationLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type DivergenceSeverity = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ConvergenceCertificationRank =
  | 'FULL'
  | 'PARTIAL'
  | 'CONDITIONAL'
  | 'BLOCKED';

export type ConvergenceViolationCode =
  | 'CONVERGENCE_READONLY_INVARIANT_BROKEN'
  | 'CONVERGENCE_COLLAPSE'
  | 'CONVERGENCE_FIXED_POINT_UNSTABLE'
  | 'CONVERGENCE_DIVERGENCE'
  | 'CONVERGENCE_SATURATION_CRITICAL'
  | 'CONVERGENCE_TERMINAL_RESOLUTION_FAILED'
  | 'CONVERGENCE_MONOTONICITY_BROKEN'
  | 'CONVERGENCE_TOPOLOGY_FRAGMENTED'
  | 'CONVERGENCE_INFINITE_RESOLUTION'
  | 'CONVERGENCE_RECURSIVE_COLLAPSE'
  | 'CONVERGENCE_CERTIFICATION_INVALID'
  | 'CONVERGENCE_NON_DETERMINISTIC';

export type ConvergenceSeverity = 'info' | 'warn' | 'error' | 'critical';

export interface ConvergenceNode {
  readonly id: string;
  readonly layer: string;
  readonly stage: string;
  readonly liveExecutionEnabled: boolean;
  readonly retryEnabled: boolean;
  readonly backgroundEnabled: boolean;
  readonly realUsersAllowed: boolean;
  readonly value: number;
  readonly successors: readonly string[];
  readonly signature: string;
}

export interface ConvergenceSpace {
  readonly nodes: readonly ConvergenceNode[];
  readonly signature: string;
  readonly frozen: true;
}

export interface ResolutionFixedPoint {
  readonly id: string;
  readonly members: readonly string[];
  readonly iterations: number;
  readonly stable: boolean;
  readonly classification: ConvergenceClass;
}

export interface ConvergenceTopology {
  readonly nodes: number;
  readonly edges: number;
  readonly cycles: number;
  readonly fragments: number;
  readonly fragmented: boolean;
  readonly recursive: boolean;
}

export interface SaturationEnvelope {
  readonly level: SaturationLevel;
  readonly score: number;
  readonly collapsed: boolean;
  readonly propagationSaturated: boolean;
  readonly terminalSaturated: boolean;
}

export interface TerminalResolutionState {
  readonly terminality: ResolutionTerminality;
  readonly infinite: boolean;
  readonly partial: boolean;
  readonly failed: boolean;
}

export interface MonotonicResolution {
  readonly classification: MonotonicityClass;
  readonly score: number;
  readonly regressed: boolean;
  readonly reversed: boolean;
}

export interface StabilityEnvelopeModel {
  readonly bounded: boolean;
  readonly overflow: boolean;
  readonly recursiveInstability: boolean;
  readonly containment: number;
}

export interface DivergenceTopology {
  readonly severity: DivergenceSeverity;
  readonly recursive: boolean;
  readonly crossLayer: boolean;
  readonly fragmented: boolean;
  readonly radius: number;
}

export interface ConvergenceCertification {
  readonly rank: ConvergenceCertificationRank;
  readonly confidence: number;
  readonly safe: boolean;
  readonly reasons: readonly string[];
}

export interface ConvergenceRisk {
  readonly code: ConvergenceViolationCode;
  readonly severity: ConvergenceSeverity;
  readonly description: string;
}

export interface RuntimeConvergenceEnvelope {
  readonly id: string;
  readonly space: ConvergenceSpace;
  readonly fixedPoints: readonly ResolutionFixedPoint[];
  readonly classification: ConvergenceClass;
  readonly topology: ConvergenceTopology;
  readonly saturation: SaturationEnvelope;
  readonly terminal: TerminalResolutionState;
  readonly monotonic: MonotonicResolution;
  readonly stability: StabilityEnvelopeModel;
  readonly divergence: DivergenceTopology;
  readonly certification: ConvergenceCertification;
  readonly risks: readonly ConvergenceRisk[];
  readonly score: number;
  readonly stable: boolean;
}

export interface RuntimeConvergenceAggregate {
  readonly envelopes: readonly RuntimeConvergenceEnvelope[];
  readonly score: number;
  readonly confidence: number;
  readonly worstSeverity: ConvergenceSeverity;
  readonly worstDivergence: DivergenceSeverity;
  readonly worstSaturation: SaturationLevel;
  readonly stable: boolean;
  readonly risks: readonly ConvergenceRisk[];
}
