/**
 * Fase 1.7.2 — Drift Snapshot + Consistency Observatory (READ-ONLY).
 *
 * Explainers PUROS. Geram strings determinísticas para auditoria humana.
 * SEM markdown UI, SEM toast, SEM componentes React, SEM renderização.
 */

import type {
  ConsistencyFlowState,
  ConsistencyRisk,
  ConsistencySnapshot,
} from './snapshotTypes';

export function explainConsistencyRisk(risk: ConsistencyRisk): string {
  return `[${risk.severity.toUpperCase()}] ${risk.flow} :: ${risk.type} — ${risk.reason}`;
}

export function explainConsistencyFlow(state: ConsistencyFlowState): string {
  const lines: string[] = [];
  lines.push(`flow=${state.flow}`);
  lines.push(`  readiness=${state.readiness}`);
  lines.push(`  execution_mode=${state.executionMode}`);
  lines.push(`  ownership=${state.ownership}`);
  lines.push(
    `  steps=${state.steps} multi_write=${state.isMultiWrite} atomic=${state.supportsAtomic} rollback=${state.supportsRollback}`,
  );
  lines.push(
    `  boundary=${state.boundaryState.boundary} canonical=${state.boundaryState.hasCanonicalBoundary} tracker=${state.boundaryState.hasTracker}`,
  );
  lines.push(
    `  mirror=${state.mirrorState.hasMirror} required=${state.mirrorState.mirrorRequired} dual_write=${state.requiresDualWrite}`,
  );
  lines.push(
    `  finalize=${state.requiresFinalize} avatar_sync=${state.requiresAvatarSync} progress_sync=${state.requiresProgressSync} eventual_sync=${state.dependsOnEventualSync}`,
  );
  lines.push(`  drift_potential=[${state.driftPotential.join(',')}]`);
  lines.push(`  severity=${state.severity}`);
  if (state.risks.length > 0) {
    lines.push('  risks:');
    for (const r of state.risks) lines.push(`    - ${explainConsistencyRisk(r)}`);
  }
  return lines.join('\n');
}

export function explainConsistencySnapshot(snapshot: ConsistencySnapshot): string {
  const lines: string[] = [];
  lines.push('=== Consistency Snapshot ===');
  lines.push(`execution_mode=${snapshot.executionMode}`);
  lines.push(`flows=${snapshot.totalFlows} ready=${snapshot.readyFlows} partial=${snapshot.partialFlows} blocked=${snapshot.blockedFlows}`);
  lines.push(`max_severity=${snapshot.maxSeverity}`);
  const s = snapshot.severitySummary;
  lines.push(
    `severity_summary: safe=${s.safe} low=${s.low} medium=${s.medium} high=${s.high} critical=${s.critical}`,
  );
  lines.push('--- flows ---');
  for (const f of snapshot.flows) lines.push(explainConsistencyFlow(f));
  return lines.join('\n');
}
