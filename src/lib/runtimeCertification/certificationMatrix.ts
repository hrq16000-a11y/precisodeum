/**
 * Fase 1.7.12 — Runtime certification matrix (READ-ONLY).
 *
 * Decisões derivam SOMENTE das fases 1.7.0 → 1.7.11.
 */

import { OPERATION_REGISTRY, type FlowId } from '@/lib/operations/operationRegistry';
import { calculateBlastRadius } from '@/lib/atomicSimulation/blastRadius';
import { buildGovernanceState } from '@/lib/atomicGovernance/governanceMatrix';
import { getPilotCandidate } from '@/lib/atomicPilot/pilotCandidates';
import { buildExecutionCertification } from './executionCertification';
import { calculateParityCertification } from './parityCertification';
import { calculateRollbackCertification } from './rollbackCertification';
import { buildObservabilityCertification } from './observabilityCertification';
import { buildDriftCertification } from './driftCertification';
import type {
  RuntimeCertificationClass,
  RuntimeCertificationDecision,
  RuntimeCertificationLevel,
  RuntimeCertificationMatrix,
  RuntimeCertificationRisk,
  RuntimeCertificationState,
  RuntimeIsolationCertification,
} from './certificationTypes';

const LEVEL_RANK: Record<RuntimeCertificationLevel, number> = {
  NONE: 0,
  LIMITED: 1,
  CONDITIONAL: 2,
  FULL: 3,
};

function worstLevel(...levels: RuntimeCertificationLevel[]): RuntimeCertificationLevel {
  let worst: RuntimeCertificationLevel = 'FULL';
  for (const l of levels) {
    if (LEVEL_RANK[l] < LEVEL_RANK[worst]) worst = l;
  }
  return worst;
}

function decisionFromLevel(
  level: RuntimeCertificationLevel,
  freezeFrozen: boolean,
): RuntimeCertificationDecision {
  if (freezeFrozen) return 'BLOCKED';
  switch (level) {
    case 'NONE':
      return 'SHADOW_ONLY';
    case 'LIMITED':
      return 'LIMITED_CERTIFIED';
    case 'CONDITIONAL':
      return 'CONDITIONAL_CERTIFIED';
    case 'FULL':
      return 'FULL_CERTIFIED';
  }
}

function classFromLevel(
  level: RuntimeCertificationLevel,
  freezeFrozen: boolean,
): RuntimeCertificationClass {
  if (freezeFrozen) return 'frozen';
  switch (level) {
    case 'NONE':
      return 'shadow_only';
    case 'LIMITED':
      return 'limited_certified';
    case 'CONDITIONAL':
      return 'conditional_certified';
    case 'FULL':
      return 'full_certified';
  }
}

function riskOf(blast: string, level: RuntimeCertificationLevel): RuntimeCertificationRisk {
  if (blast === 'CRITICAL') return 'CRITICAL';
  if (level === 'NONE') return 'HIGH';
  if (level === 'LIMITED') return 'MEDIUM';
  return 'LOW';
}

function isolationFor(flow: FlowId): RuntimeIsolationCertification {
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow)!;
  const blast = calculateBlastRadius(flow);
  const isolation = reg.ownership === 'mixed'
    ? 'partial'
    : reg.steps.length === 1
    ? 'strict_isolated'
    : 'boundary_isolated';
  return {
    flow,
    boundary: reg.boundary,
    ownershipCoupling: reg.ownership === 'mixed',
    mirrorCoupling: !!blast?.mirrorCoupling,
    adminExposure: reg.boundary === 'adminWriteBoundary',
    isolation,
    safe: isolation !== 'partial' && isolation !== 'unsafe',
  };
}

export function buildRuntimeCertification(
  flow: FlowId,
): RuntimeCertificationState | null {
  const gov = buildGovernanceState(flow);
  const blast = calculateBlastRadius(flow);
  const candidate = getPilotCandidate(flow);
  if (!gov || !blast || !candidate) return null;

  const execution = buildExecutionCertification(flow);
  const parity = calculateParityCertification(flow);
  const rollback = calculateRollbackCertification(flow);
  const observability = buildObservabilityCertification(flow);
  const drift = buildDriftCertification(flow);
  if (!execution) return null;

  const freezeFrozen =
    gov.freeze.level === 'HARD_FREEZE' || gov.freeze.level === 'GLOBAL_FREEZE';

  // Nível global = pior nível entre TODAS as certificações.
  let level = worstLevel(
    execution.safety,
    parity.level,
    rollback.level,
    observability.level,
    drift.level,
  );

  // Regras blindadas adicionais:
  if (blast.level === 'CRITICAL' && level === 'FULL') level = 'LIMITED';
  if (gov.risk.conditional && level === 'FULL') level = 'CONDITIONAL';
  if (freezeFrozen) level = 'NONE';

  return {
    flow,
    decision: decisionFromLevel(level, freezeFrozen),
    certificationClass: classFromLevel(level, freezeFrozen),
    level,
    risk: riskOf(blast.level, level),
    blast: blast.level,
    freeze: gov.freeze.level,
    governance: gov.decision,
    currentStage: 'STAGE_0_READ_ONLY',
    maxAllowedStage: freezeFrozen ? 'STAGE_0_READ_ONLY' : gov.promotionGuard.maxAllowedStage,
    execution,
    isolation: isolationFor(flow),
    rollback,
    parity,
    observability,
    drift,
    rollbackClass: candidate.rollback,
    liveExecutionEnabled: false,
    realUsersAllowed: false,
    retryEnabled: false,
    backgroundEnabled: false,
  };
}

export function buildRuntimeCertificationMatrix(): RuntimeCertificationMatrix {
  const rows: RuntimeCertificationState[] = [];
  for (const r of OPERATION_REGISTRY) {
    const s = buildRuntimeCertification(r.flow);
    if (s) rows.push(s);
  }
  return {
    rows,
    totals: {
      flows: rows.length,
      blocked: rows.filter((r) => r.decision === 'BLOCKED').length,
      shadowOnly: rows.filter((r) => r.decision === 'SHADOW_ONLY').length,
      limited: rows.filter((r) => r.decision === 'LIMITED_CERTIFIED').length,
      conditional: rows.filter((r) => r.decision === 'CONDITIONAL_CERTIFIED').length,
      full: rows.filter((r) => r.decision === 'FULL_CERTIFIED').length,
    },
  };
}

export function summarizeRuntimeCertification(): string {
  const m = buildRuntimeCertificationMatrix();
  return `[CERT] flows=${m.totals.flows} blocked=${m.totals.blocked} shadow=${m.totals.shadowOnly} limited=${m.totals.limited} conditional=${m.totals.conditional} full=${m.totals.full}`;
}

export function rankRuntimeCertificationRisk(): FlowId[] {
  const ORDER: Record<RuntimeCertificationRisk, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };
  return buildRuntimeCertificationMatrix()
    .rows.slice()
    .sort((a, b) => ORDER[a.risk] - ORDER[b.risk])
    .map((r) => r.flow);
}

export function buildCertificationCoverage(): {
  total: number;
  covered: number;
  missing: FlowId[];
} {
  const m = buildRuntimeCertificationMatrix();
  const seen = new Set(m.rows.map((r) => r.flow));
  const missing: FlowId[] = [];
  for (const r of OPERATION_REGISTRY) if (!seen.has(r.flow)) missing.push(r.flow);
  return { total: OPERATION_REGISTRY.length, covered: m.rows.length, missing };
}
