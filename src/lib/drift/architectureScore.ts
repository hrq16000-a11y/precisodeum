/**
 * Fase 1.7.3 — Architecture score (READ-ONLY, PURE, DETERMINÍSTICO).
 *
 * Calcula coberturas estruturais a partir de registries existentes:
 *  - OPERATION_REGISTRY (1.7.0)
 *  - FLOW_DRIFT_PROFILES (1.7.1)
 *  - QUARANTINED_WRITES (1.7.3)
 *
 * Sem Supabase, hooks, timers, window, localStorage. Mesma entrada → mesma saída.
 */

import {
  OPERATION_REGISTRY,
  type FlowId,
} from '@/lib/operations/operationRegistry';
import { FLOW_DRIFT_PROFILES } from './driftRegistry';
import { LEGACY_WRITE_PATHS } from './quarantineRegistry';
import {
  classifyFlowRegistration,
  type WriteClassification,
} from './writeClassification';

export interface ArchitectureCoverage {
  boundaryCoveragePct: number;
  trackerCoveragePct: number;
  ownershipCoveragePct: number;
  readyFlowsPct: number;
  legacyPct: number;
  unsafePct: number;
  mirrorDependencyPct: number;
  eventualSyncDependencyPct: number;
  atomicReadinessPct: number;
}

export interface ArchitectureClassificationBreakdown {
  SAFE: number;
  GUARDED: number;
  LEGACY: number;
  UNSAFE: number;
  UNKNOWN: number;
}

export interface ArchitectureScore {
  totalFlows: number;
  coverage: ArchitectureCoverage;
  classification: ArchitectureClassificationBreakdown;
  legacyQuarantined: number;
  /** 0–100, ponderado. */
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

const CANONICAL_BOUNDARIES = new Set([
  'multiWriteSync',
  'avatarSync',
  'onboardingProgressSync',
  'adminWriteBoundary',
]);

const TRACKER_BOUNDARIES = CANONICAL_BOUNDARIES;

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10; // 1 decimal
}

function gradeFor(score: number): ArchitectureScore['grade'] {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

export function calculateArchitectureScore(): ArchitectureScore {
  const total = OPERATION_REGISTRY.length;

  let withBoundary = 0;
  let withTracker = 0;
  let withOwnership = 0;
  let ready = 0;
  let legacy = 0;
  let unsafe = 0;
  let mirrorDep = 0;
  let eventualDep = 0;
  let atomicReady = 0;

  const classification: ArchitectureClassificationBreakdown = {
    SAFE: 0,
    GUARDED: 0,
    LEGACY: 0,
    UNSAFE: 0,
    UNKNOWN: 0,
  };

  for (const reg of OPERATION_REGISTRY) {
    if (CANONICAL_BOUNDARIES.has(reg.boundary)) withBoundary++;
    if (TRACKER_BOUNDARIES.has(reg.boundary)) withTracker++;
    if (reg.ownership === 'profile' || reg.ownership === 'provider' || reg.ownership === 'mixed') {
      withOwnership++;
    }
    if (reg.readiness === 'READY') ready++;
    if (reg.supportsAtomic && reg.readiness === 'READY') atomicReady++;

    const profile = FLOW_DRIFT_PROFILES.find((p) => p.flow === reg.flow);
    if (profile?.depends_on_mirror) mirrorDep++;
    if (profile?.depends_on_eventual_sync) eventualDep++;

    const cls = classifyFlowRegistration(reg).classification;
    classification[cls]++;
    if (cls === 'LEGACY') legacy++;
    if (cls === 'UNSAFE') unsafe++;
  }

  const coverage: ArchitectureCoverage = {
    boundaryCoveragePct: pct(withBoundary, total),
    trackerCoveragePct: pct(withTracker, total),
    ownershipCoveragePct: pct(withOwnership, total),
    readyFlowsPct: pct(ready, total),
    legacyPct: pct(legacy, total),
    unsafePct: pct(unsafe, total),
    mirrorDependencyPct: pct(mirrorDep, total),
    eventualSyncDependencyPct: pct(eventualDep, total),
    atomicReadinessPct: pct(atomicReady, total),
  };

  // Score ponderado 0–100.
  // Positivos: boundary(20) + tracker(20) + ownership(15) + ready(20) + atomic(15) = 90
  // Penalidades: unsafe(-25 cada %) + legacy(-5 cada %)
  const positive =
    coverage.boundaryCoveragePct * 0.20 +
    coverage.trackerCoveragePct * 0.20 +
    coverage.ownershipCoveragePct * 0.15 +
    coverage.readyFlowsPct * 0.20 +
    coverage.atomicReadinessPct * 0.15;
  // Base máxima = 90; somamos 10 "estrutura" se nenhum unsafe.
  const structuralBonus = unsafe === 0 ? 10 : 0;
  const penalty = coverage.unsafePct * 0.25 + coverage.legacyPct * 0.05;
  const raw = Math.max(0, Math.min(100, positive + structuralBonus - penalty));
  const score = Math.round(raw * 10) / 10;

  return {
    totalFlows: total,
    coverage,
    classification,
    legacyQuarantined: LEGACY_WRITE_PATHS.length,
    score,
    grade: gradeFor(score),
  };
}

export function summarizeArchitectureHealth(score: ArchitectureScore): string {
  const c = score.coverage;
  return [
    `score=${score.score} grade=${score.grade} flows=${score.totalFlows}`,
    `coverage: boundary=${c.boundaryCoveragePct}% tracker=${c.trackerCoveragePct}% ownership=${c.ownershipCoveragePct}% ready=${c.readyFlowsPct}% atomic=${c.atomicReadinessPct}%`,
    `dependencies: mirror=${c.mirrorDependencyPct}% eventual=${c.eventualSyncDependencyPct}%`,
    `risk: unsafe=${c.unsafePct}% legacy=${c.legacyPct}% quarantined=${score.legacyQuarantined}`,
    `classification: SAFE=${score.classification.SAFE} GUARDED=${score.classification.GUARDED} LEGACY=${score.classification.LEGACY} UNSAFE=${score.classification.UNSAFE} UNKNOWN=${score.classification.UNKNOWN}`,
  ].join('\n');
}

export function explainArchitectureScore(score: ArchitectureScore): string {
  return [
    '=== Architecture Score ===',
    summarizeArchitectureHealth(score),
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Platform risk aggregation (extends 1.7.2 snapshot semantics).
// ---------------------------------------------------------------------------

export interface PlatformRiskSummary {
  score: ArchitectureScore;
  hasUnsafeFlows: boolean;
  hasUnquarantinedLegacy: boolean;
  recommendsAtomicMigration: FlowId[];
}

export function summarizePlatformRisk(): PlatformRiskSummary {
  const score = calculateArchitectureScore();
  const recommendsAtomicMigration: FlowId[] = [];
  let hasUnsafeFlows = false;
  let hasUnquarantinedLegacy = false;

  for (const reg of OPERATION_REGISTRY) {
    const cls = classifyFlowRegistration(reg).classification;
    if (cls === 'UNSAFE') hasUnsafeFlows = true;
    if (cls === 'LEGACY') {
      const quarantined = LEGACY_WRITE_PATHS.some((q) => q.flow === reg.flow);
      if (!quarantined) hasUnquarantinedLegacy = true;
    }
    if (reg.steps.length > 1 && reg.supportsAtomic && reg.readiness !== 'READY') {
      recommendsAtomicMigration.push(reg.flow);
    }
  }

  return { score, hasUnsafeFlows, hasUnquarantinedLegacy, recommendsAtomicMigration };
}
