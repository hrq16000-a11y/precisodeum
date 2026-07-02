/**
 * Fase 1.7.4 — Operational integrity assertion (PURE, READ-ONLY).
 *
 * Falha (retorna ok:false + violations) se:
 *  - flow HIGH/CRITICAL perder tracker
 *  - flow HIGH/CRITICAL perder boundary
 *  - drift_rate aumentar estruturalmente (baseline > 0)
 *  - mirror_dependency crescer sem ownership resolvido
 *  - READY flow degradar health sem quarantine
 *
 * Nunca lança. Caller decide o que fazer com violations.
 */

import { OPERATION_REGISTRY, type FlowId } from '@/lib/operations/operationRegistry';
import { isQuarantinedFlow } from '@/lib/drift/quarantineRegistry';
import type { OperationalSnapshot } from './operationalSnapshot';

export type IntegrityViolationCode =
  | 'high_risk_missing_tracker'
  | 'high_risk_missing_boundary'
  | 'drift_rate_regressed'
  | 'mirror_growth_without_ownership'
  | 'ready_flow_degraded_without_quarantine';

export interface IntegrityViolation {
  flow: FlowId;
  code: IntegrityViolationCode;
  reason: string;
}

export interface IntegrityResult {
  ok: boolean;
  violations: IntegrityViolation[];
}

export interface IntegrityBaseline {
  driftRateByFlow?: Partial<Record<FlowId, number>>;
  mirrorRateByFlow?: Partial<Record<FlowId, number>>;
}

const TRACKER_BOUNDARIES = new Set([
  'multiWriteSync',
  'avatarSync',
  'onboardingProgressSync',
  'adminWriteBoundary',
]);

export function assertOperationalIntegrity(
  snapshot: OperationalSnapshot,
  baseline: IntegrityBaseline = {},
): IntegrityResult {
  const violations: IntegrityViolation[] = [];
  const driftMap = new Map(snapshot.telemetry.drifts.map((d) => [d.flow, d]));
  const mirrorMap = new Map(snapshot.telemetry.mirrors.map((m) => [m.flow, m]));
  const healthMap = new Map(snapshot.runtimeHealth.map((h) => [h.flow, h]));

  for (const risk of snapshot.operationalRisk) {
    if (risk.riskLevel !== 'HIGH' && risk.riskLevel !== 'CRITICAL') continue;
    const reg = OPERATION_REGISTRY.find((r) => r.flow === risk.flow);
    if (!reg) continue;
    if (reg.boundary === 'inline_call_site') {
      violations.push({
        flow: risk.flow,
        code: 'high_risk_missing_boundary',
        reason: `flow ${risk.flow} é ${risk.riskLevel} sem boundary canônica`,
      });
    }
    if (!TRACKER_BOUNDARIES.has(reg.boundary)) {
      violations.push({
        flow: risk.flow,
        code: 'high_risk_missing_tracker',
        reason: `flow ${risk.flow} é ${risk.riskLevel} sem tracker estrutural`,
      });
    }
  }

  if (baseline.driftRateByFlow) {
    for (const [flow, base] of Object.entries(baseline.driftRateByFlow)) {
      const current = driftMap.get(flow as FlowId);
      if (!current || base === undefined) continue;
      if (current.driftRate > (base as number) + 0.05) {
        violations.push({
          flow: flow as FlowId,
          code: 'drift_rate_regressed',
          reason: `drift_rate aumentou ${current.driftRate} vs baseline ${base}`,
        });
      }
    }
  }

  if (baseline.mirrorRateByFlow) {
    for (const [flow, base] of Object.entries(baseline.mirrorRateByFlow)) {
      const current = mirrorMap.get(flow as FlowId);
      if (!current || base === undefined) continue;
      if (current.mirrorRate > (base as number) + 0.05 && !current.hasOwnershipResolved) {
        violations.push({
          flow: flow as FlowId,
          code: 'mirror_growth_without_ownership',
          reason: `mirror_rate aumentou ${current.mirrorRate} vs ${base} sem ownership`,
        });
      }
    }
  }

  for (const reg of OPERATION_REGISTRY) {
    if (reg.readiness !== 'READY') continue;
    const h = healthMap.get(reg.flow);
    if (!h) continue;
    if (
      h.isStructurallyReadyButOperationallyDegraded &&
      !isQuarantinedFlow(reg.flow)
    ) {
      // Só sinaliza se há volume mínimo (confidence) para evitar ruído.
      if (h.confidence === 'medium' || h.confidence === 'high') {
        violations.push({
          flow: reg.flow,
          code: 'ready_flow_degraded_without_quarantine',
          reason: `READY flow ${reg.flow} degradou (score=${h.score}) sem quarentena`,
        });
      }
    }
  }

  return { ok: violations.length === 0, violations };
}
