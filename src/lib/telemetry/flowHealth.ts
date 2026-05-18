/**
 * Fase 1.7.4 — Flow health engine (PURE, READ-ONLY).
 *
 * Determinístico. Identifica:
 *  - fluxos super-acoplados (muitos steps/side-effects)
 *  - fluxos dependentes demais de mirror
 *  - flows READY estruturalmente mas operacionalmente degradados
 */

import {
  OPERATION_REGISTRY,
  type FlowId,
} from '@/lib/operations/operationRegistry';
import { getFlowDriftProfile } from '@/lib/drift/driftRegistry';
import type {
  DriftTelemetry,
  FlowExecutionTelemetry,
  FlowHealthGrade,
  MirrorUsageTelemetry,
  RuntimeFlowHealth,
} from './runtimeTelemetryTypes';
import { confidenceFromVolume } from './buildRuntimeTelemetry';

function gradeFromScore(score: number): FlowHealthGrade {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

export function detectOvercoupledFlow(flow: FlowId): boolean {
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  if (!reg) return false;
  // overcoupling = many steps + many side-effects
  return reg.steps.length >= 3 || reg.sideEffects.length >= 3;
}

export function detectMirrorOverdependence(
  flow: FlowId,
  mirrors: ReadonlyArray<MirrorUsageTelemetry>,
): boolean {
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  const m = mirrors.find((x) => x.flow === flow);
  if (!reg || !m) return false;
  const profile = getFlowDriftProfile(flow);
  if (!profile?.depends_on_mirror) return false;
  return m.mirrorRate >= 0.75 && reg.ownership === 'mixed';
}

export function detectOperationalInstability(
  exec: FlowExecutionTelemetry | undefined,
  drift: DriftTelemetry | undefined,
): boolean {
  if (!exec) return false;
  if (exec.failureRate >= 0.1) return true;
  if (exec.partialRate >= 0.15) return true;
  if (drift && drift.driftRate >= 0.1) return true;
  return false;
}

export function calculateFlowHealth(
  flows: ReadonlyArray<FlowExecutionTelemetry>,
  drifts: ReadonlyArray<DriftTelemetry>,
  mirrors: ReadonlyArray<MirrorUsageTelemetry>,
): RuntimeFlowHealth[] {
  const execMap = new Map(flows.map((f) => [f.flow, f]));
  const driftMap = new Map(drifts.map((d) => [d.flow, d]));
  const mirrorMap = new Map(mirrors.map((m) => [m.flow, m]));
  const out: RuntimeFlowHealth[] = [];

  for (const reg of OPERATION_REGISTRY) {
    const exec = execMap.get(reg.flow);
    const drift = driftMap.get(reg.flow);
    const mirror = mirrorMap.get(reg.flow);

    let score = 100;
    if (reg.readiness === 'PARTIAL') score -= 15;
    if (reg.readiness === 'BLOCKED') score -= 35;
    if (exec) {
      score -= Math.min(40, exec.failureRate * 100);
      score -= Math.min(20, exec.partialRate * 50);
    }
    if (drift) score -= Math.min(30, drift.driftRate * 100);
    if (detectOvercoupledFlow(reg.flow)) score -= 5;
    if (detectMirrorOverdependence(reg.flow, mirrors)) score -= 5;

    score = Math.max(0, Math.round(score * 10) / 10);

    const failureRate = exec?.failureRate ?? 0;
    const driftRate = drift?.driftRate ?? 0;
    const mirrorRate = mirror?.mirrorRate ?? 0;
    const unstable = detectOperationalInstability(exec, drift);
    const overcoupled = detectOvercoupledFlow(reg.flow);
    const overMirror = detectMirrorOverdependence(reg.flow, mirrors);
    const degraded = reg.readiness === 'READY' && (unstable || score < 75);

    out.push({
      flow: reg.flow,
      grade: gradeFromScore(score),
      score,
      readiness: reg.readiness,
      failureRate,
      driftRate,
      mirrorRate,
      isOvercoupled: overcoupled,
      isOverdependentOnMirror: overMirror,
      isStructurallyReadyButOperationallyDegraded: degraded,
      confidence: confidenceFromVolume(exec?.executions ?? 0),
    });
  }
  return out;
}
