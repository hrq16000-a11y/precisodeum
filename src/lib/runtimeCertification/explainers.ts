/**
 * Fase 1.7.12 — Runtime certification explainers (READ-ONLY, pure strings).
 */

import type {
  RuntimeCertificationState,
  RuntimeExecutionCertification,
  RuntimeRollbackCertification,
  RuntimeObservabilityCertification,
  RuntimeDriftCertification,
} from './certificationTypes';

export function explainRuntimeCertification(s: RuntimeCertificationState): string {
  return `[CERT/${s.decision}] ${s.flow} class=${s.certificationClass} level=${s.level} risk=${s.risk} blast=${s.blast} freeze=${s.freeze} max=${s.maxAllowedStage}`;
}

export function explainExecutionCertification(
  e: RuntimeExecutionCertification,
): string {
  return `[CERT/EXEC] ${e.flow} class=${e.executionClass} isolation=${e.isolation} rollback=${e.rollback} determinism=${e.determinism} ordering=${e.ordering} parity=${e.parityOk} safety=${e.safety}`;
}

export function explainRollbackCertification(
  r: RuntimeRollbackCertification,
): string {
  return `[CERT/ROLLBACK] ${r.flow} class=${r.rollback} level=${r.level} consistency=${r.consistencyOk} dependencyOk=${r.dependencyOk} unsafe=${r.unsafeDependencies.join(',') || 'none'}`;
}

export function explainParityCertification(p: {
  flow: string;
  score: number;
  level: string;
  stable: boolean;
  regressions: string[];
}): string {
  return `[CERT/PARITY] ${p.flow} score=${p.score} level=${p.level} stable=${p.stable} regressions=${p.regressions.length}`;
}

export function explainDriftCertification(d: RuntimeDriftCertification): string {
  return `[CERT/DRIFT] ${d.flow} severity=${d.severity} contained=${d.contained} unbounded=${d.unbounded} level=${d.level}`;
}

export function explainObservabilityCertification(
  o: RuntimeObservabilityCertification,
): string {
  return `[CERT/OBS] ${o.flow} coverage=${o.coverage} confidence=${o.confidence} level=${o.level} gaps=${o.gaps.join(',') || 'none'}`;
}
