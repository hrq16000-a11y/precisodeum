/**
 * Fase 1.7.4 — Explainers operacionais (PURE).
 *
 * Geram strings determinísticas. Sem React, sem markdown render, sem UI.
 */

import type {
  AtomicMigrationPriorityEntry,
  OperationalRiskTelemetry,
  RuntimeFlowHealth,
  TelemetryAggregation,
} from './runtimeTelemetryTypes';

export function explainOperationalRisk(risk: OperationalRiskTelemetry): string {
  return `[RISK/${risk.riskLevel}] ${risk.flow} score=${risk.riskScore} readiness=${risk.readiness} eventual=${risk.exposesEventualConsistency} :: ${risk.contributors.join(',')}`;
}

export function explainAtomicPriority(p: AtomicMigrationPriorityEntry): string {
  return `[ATOMIC/${p.priority}] ${p.flow} score=${p.score} :: ${p.reasons.join(',')}`;
}

export function explainFlowHealth(h: RuntimeFlowHealth): string {
  const flags: string[] = [];
  if (h.isOvercoupled) flags.push('overcoupled');
  if (h.isOverdependentOnMirror) flags.push('mirror_overdep');
  if (h.isStructurallyReadyButOperationallyDegraded) flags.push('ready_but_degraded');
  return `[HEALTH/${h.grade}] ${h.flow} score=${h.score} readiness=${h.readiness} fail=${h.failureRate} drift=${h.driftRate} mirror=${h.mirrorRate} flags=[${flags.join(',')}] confidence=${h.confidence}`;
}

export function explainTelemetrySummary(agg: TelemetryAggregation): string {
  const lines: string[] = [];
  lines.push('=== Runtime Telemetry ===');
  lines.push(`events=${agg.totalEvents} flows=${agg.flows.length} confidence=${agg.overallConfidence}`);
  lines.push('--- risks ---');
  for (const r of agg.risks) lines.push(explainOperationalRisk(r));
  lines.push('--- priorities ---');
  for (const p of agg.priorities) lines.push(explainAtomicPriority(p));
  lines.push('--- health ---');
  for (const h of agg.health) lines.push(explainFlowHealth(h));
  return lines.join('\n');
}
