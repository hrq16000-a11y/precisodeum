/**
 * Fase 1.7.5 — Guarantees engine (PURE, READ-ONLY).
 *
 * Calcula nível de garantia (NONE/PARTIAL/STRONG/VERIFIED) por flow, por
 * categoria estrutural. Determinístico.
 */

import {
  OPERATION_REGISTRY,
  type FlowId,
} from '@/lib/operations/operationRegistry';
import { getFlowDriftProfile } from '@/lib/drift/driftRegistry';
import { isQuarantinedFlow } from '@/lib/drift/quarantineRegistry';
import { classifyFlowRegistration } from '@/lib/drift/writeClassification';
import type { GuaranteeLevel } from './contractTypes';

export type GuaranteeId =
  | 'ownership'
  | 'boundary'
  | 'observability'
  | 'rollback_visibility'
  | 'telemetry'
  | 'quarantine'
  | 'atomic_readiness';

export interface FlowGuarantees {
  flow: FlowId;
  levels: Record<GuaranteeId, GuaranteeLevel>;
  overall: GuaranteeLevel;
}

export interface GuaranteeViolation {
  flow: FlowId;
  guarantee: GuaranteeId;
  level: GuaranteeLevel;
  reason: string;
}

const TRACKER_BOUNDARIES = new Set([
  'multiWriteSync',
  'avatarSync',
  'onboardingProgressSync',
  'adminWriteBoundary',
]);

function rank(level: GuaranteeLevel): number {
  switch (level) {
    case 'NONE':
      return 0;
    case 'PARTIAL':
      return 1;
    case 'STRONG':
      return 2;
    case 'VERIFIED':
      return 3;
  }
}

function min(a: GuaranteeLevel, b: GuaranteeLevel): GuaranteeLevel {
  return rank(a) <= rank(b) ? a : b;
}

export function calculateGuaranteeLevel(flow: FlowId): FlowGuarantees | null {
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  if (!reg) return null;
  const profile = getFlowDriftProfile(flow);
  const cls = classifyFlowRegistration(reg).classification;

  const ownership: GuaranteeLevel =
    reg.ownership === 'profile' || reg.ownership === 'provider'
      ? 'VERIFIED'
      : reg.ownership === 'mixed' && profile?.depends_on_mirror
      ? 'STRONG'
      : reg.ownership === 'mixed'
      ? 'PARTIAL'
      : 'NONE';

  const boundary: GuaranteeLevel = TRACKER_BOUNDARIES.has(reg.boundary)
    ? 'STRONG'
    : reg.boundary === 'inline_call_site'
    ? 'NONE'
    : 'PARTIAL';

  const observability: GuaranteeLevel = TRACKER_BOUNDARIES.has(reg.boundary)
    ? 'VERIFIED'
    : 'PARTIAL';

  // Rollback visibility:
  //  - explicit client-side rollback ⇒ STRONG
  //  - single-step write ⇒ VERIFIED (nothing to roll back)
  //  - READY multi-step atomic ⇒ STRONG (atomic boundary IS the rollback contract)
  //  - PARTIAL/LEGACY multi-step atomic ⇒ PARTIAL (atomic migration pending)
  //  - multi-step non-atomic ⇒ NONE
  const rollback_visibility: GuaranteeLevel = reg.supportsRollback
    ? 'STRONG'
    : reg.steps.length === 1
    ? 'VERIFIED'
    : reg.supportsAtomic && reg.readiness === 'READY'
    ? 'STRONG'
    : reg.supportsAtomic
    ? 'PARTIAL'
    : 'NONE';

  // Telemetry 1.7.4 cobre 100% dos flows.
  const telemetry: GuaranteeLevel = 'VERIFIED';

  const quarantine: GuaranteeLevel =
    cls === 'LEGACY' && !isQuarantinedFlow(flow)
      ? 'NONE'
      : cls === 'LEGACY' && isQuarantinedFlow(flow)
      ? 'STRONG'
      : cls === 'SAFE' || cls === 'GUARDED'
      ? 'VERIFIED'
      : 'PARTIAL';

  const atomic_readiness: GuaranteeLevel =
    reg.readiness === 'READY' && reg.supportsAtomic
      ? 'VERIFIED'
      : reg.readiness === 'PARTIAL' && reg.supportsAtomic
      ? 'STRONG'
      : reg.supportsAtomic
      ? 'PARTIAL'
      : 'NONE';

  const levels: Record<GuaranteeId, GuaranteeLevel> = {
    ownership,
    boundary,
    observability,
    rollback_visibility,
    telemetry,
    quarantine,
    atomic_readiness,
  };

  const overall = (Object.values(levels) as GuaranteeLevel[]).reduce<GuaranteeLevel>(
    (acc, l) => min(acc, l),
    'VERIFIED',
  );

  return { flow, levels, overall };
}

export interface GuaranteeCoverageSummary {
  flows: FlowGuarantees[];
  overallByCategory: Record<GuaranteeId, GuaranteeLevel>;
  weakest: { flow: FlowId; level: GuaranteeLevel } | null;
}

export function explainGuaranteeCoverage(): GuaranteeCoverageSummary {
  const flows: FlowGuarantees[] = [];
  for (const r of OPERATION_REGISTRY) {
    const g = calculateGuaranteeLevel(r.flow);
    if (g) flows.push(g);
  }
  const cats: GuaranteeId[] = [
    'ownership',
    'boundary',
    'observability',
    'rollback_visibility',
    'telemetry',
    'quarantine',
    'atomic_readiness',
  ];
  const overallByCategory: Record<GuaranteeId, GuaranteeLevel> = {
    ownership: 'VERIFIED',
    boundary: 'VERIFIED',
    observability: 'VERIFIED',
    rollback_visibility: 'VERIFIED',
    telemetry: 'VERIFIED',
    quarantine: 'VERIFIED',
    atomic_readiness: 'VERIFIED',
  };
  for (const c of cats) {
    let acc: GuaranteeLevel = 'VERIFIED';
    for (const f of flows) acc = min(acc, f.levels[c]);
    overallByCategory[c] = acc;
  }
  let weakest: { flow: FlowId; level: GuaranteeLevel } | null = null;
  for (const f of flows) {
    if (!weakest || rank(f.overall) < rank(weakest.level)) {
      weakest = { flow: f.flow, level: f.overall };
    }
  }
  return { flows, overallByCategory, weakest };
}

export function detectGuaranteeViolation(
  minLevel: GuaranteeLevel = 'PARTIAL',
): GuaranteeViolation[] {
  const out: GuaranteeViolation[] = [];
  const threshold = rank(minLevel);
  for (const r of OPERATION_REGISTRY) {
    const g = calculateGuaranteeLevel(r.flow);
    if (!g) continue;
    for (const [key, level] of Object.entries(g.levels) as Array<[GuaranteeId, GuaranteeLevel]>) {
      if (rank(level) < threshold) {
        out.push({
          flow: r.flow,
          guarantee: key,
          level,
          reason: `guarantee ${key}=${level} below threshold ${minLevel}`,
        });
      }
    }
  }
  return out;
}
