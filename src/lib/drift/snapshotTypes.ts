/**
 * Fase 1.7.2 — Drift Snapshot + Consistency Observatory (READ-ONLY).
 *
 * Tipos puros para o snapshot canônico de consistência da plataforma.
 * Não contém lógica, side-effects, hooks ou Supabase.
 */

import type { ContactOwner } from '@/lib/contactOwnership';
import type {
  BoundaryId,
  FlowId,
  Readiness,
} from '@/lib/operations/operationRegistry';
import type { DriftSeverity, DriftType } from './driftTypes';

export type ConsistencyExecutionMode = 'dry-run' | 'live' | 'legacy';

export type ConsistencyRiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'critical';

export type ConsistencyRiskType =
  | 'missing_boundary'
  | 'missing_tracker'
  | 'dual_write_without_owner'
  | 'eventual_sync_dependency'
  | 'mirror_dependency'
  | 'non_atomic_multi_write'
  | 'missing_rollback'
  | 'legacy_write_path'
  | 'unsafe_live_dependency';

export interface ConsistencyMirrorState {
  /** Tabela canônica deste flow (profiles, providers, ambos). */
  canonicalOwner: ContactOwner | 'mixed';
  /** O flow grava em uma tabela secundária como mirror. */
  hasMirror: boolean;
  /** O mirror é semanticamente necessário hoje (dual-write legítimo). */
  mirrorRequired: boolean;
  /** Tipos de drift que esse mirror pode produzir. */
  mirrorDriftPotential: DriftType[];
}

export interface ConsistencyBoundaryState {
  /** Boundary client-side que possui este flow. */
  boundary: BoundaryId;
  /** Boundary explícita (não é call-site inline). */
  hasCanonicalBoundary: boolean;
  /** Boundary possui tracker de partial-failure (multiWriteSync etc.). */
  hasTracker: boolean;
  /** Boundary suporta rollback client-side. */
  hasRollback: boolean;
}

export interface ConsistencyFlowState {
  flow: FlowId;
  readiness: Readiness;
  executionMode: ConsistencyExecutionMode;
  ownership: ContactOwner | 'mixed';
  steps: number;
  isMultiWrite: boolean;
  requiresFinalize: boolean;
  requiresAvatarSync: boolean;
  requiresProgressSync: boolean;
  requiresDualWrite: boolean;
  dependsOnEventualSync: boolean;
  supportsAtomic: boolean;
  supportsRollback: boolean;
  boundaryState: ConsistencyBoundaryState;
  mirrorState: ConsistencyMirrorState;
  driftPotential: DriftType[];
  risks: ConsistencyRisk[];
  severity: ConsistencyRiskLevel;
}

export interface ConsistencyRisk {
  flow: FlowId;
  type: ConsistencyRiskType;
  severity: ConsistencyRiskLevel;
  reason: string;
}

export interface ConsistencySeveritySummary {
  safe: number;
  low: number;
  medium: number;
  high: number;
  critical: number;
}

export interface ConsistencySnapshot {
  generatedAt: number;
  executionMode: ConsistencyExecutionMode;
  flows: ConsistencyFlowState[];
  risks: ConsistencyRisk[];
  severitySummary: ConsistencySeveritySummary;
  maxSeverity: ConsistencyRiskLevel;
  totalFlows: number;
  readyFlows: number;
  partialFlows: number;
  blockedFlows: number;
}

const SEVERITY_RANK: Record<ConsistencyRiskLevel, number> = {
  safe: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function compareConsistencySeverity(
  a: ConsistencyRiskLevel,
  b: ConsistencyRiskLevel,
): number {
  return SEVERITY_RANK[a] - SEVERITY_RANK[b];
}

export function maxConsistencySeverity(
  levels: ConsistencyRiskLevel[],
): ConsistencyRiskLevel {
  if (levels.length === 0) return 'safe';
  return levels.reduce<ConsistencyRiskLevel>(
    (acc, l) => (compareConsistencySeverity(l, acc) > 0 ? l : acc),
    'safe',
  );
}

export function driftSeverityToConsistency(s: DriftSeverity): ConsistencyRiskLevel {
  switch (s) {
    case 'info':
      return 'safe';
    case 'low':
      return 'low';
    case 'medium':
      return 'medium';
    case 'high':
      return 'high';
    case 'critical':
      return 'critical';
  }
}
