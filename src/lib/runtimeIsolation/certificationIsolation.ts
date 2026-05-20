/**
 * Fase 1.8.6 — Isolation certification (READ-ONLY, pure).
 */

import type {
  IsolationCertification,
  IsolationClassification,
  IsolationEnvelope,
  IsolationSeverity,
  IsolationViolation,
} from './isolationTypes';

const SEVERITY_RANK: Record<IsolationSeverity, number> = {
  NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4,
};

export function classifyIsolationSafety(e: IsolationEnvelope): {
  safe: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (e.liveExecutionEnabled !== false) reasons.push('live_execution_detected');
  if (e.retryEnabled !== false) reasons.push('retry_detected');
  if (e.backgroundEnabled !== false) reasons.push('background_detected');
  if (e.realUsersAllowed !== false) reasons.push('real_users_enabled');
  if (e.currentStage !== 'STAGE_0_READ_ONLY') reasons.push('unsafe_stage');
  if (e.severity === 'CRITICAL') reasons.push('critical_severity');
  if (e.classification === 'COLLAPSED' || e.classification === 'LEAKING') reasons.push(`classification_${e.classification}`);
  return { safe: reasons.length === 0, reasons };
}

export function calculateIsolationConfidence(e: IsolationEnvelope): number {
  let conf = e.score;
  if (e.severity === 'CRITICAL') conf = Math.min(conf, 0.2);
  else if (e.severity === 'HIGH') conf = Math.min(conf, 0.5);
  else if (e.severity === 'MEDIUM') conf = Math.min(conf, 0.75);
  if (e.classification === 'COLLAPSED') conf = 0;
  if (e.classification === 'LEAKING') conf = Math.min(conf, 0.3);
  return Math.round(conf * 100) / 100;
}

export function buildIsolationCertification(e: IsolationEnvelope): IsolationCertification {
  const safety = classifyIsolationSafety(e);
  const confidence = calculateIsolationConfidence(e);
  const certified = safety.safe && (e.classification === 'FULLY_ISOLATED' || e.classification === 'CONTAINED') && confidence >= 0.6;
  return {
    flow: e.flow,
    certified,
    confidence,
    classification: e.classification,
    severity: e.severity,
    reasons: safety.reasons,
  };
}

export function detectIsolationCertificationGap(
  certs: readonly IsolationCertification[],
): IsolationViolation[] {
  const out: IsolationViolation[] = [];
  for (const c of certs) {
    if (!c.certified && c.classification === 'FULLY_ISOLATED') {
      out.push({ flow: c.flow, code: 'CERTIFICATION_INTEGRITY_GAP', detail: 'FULLY_ISOLATED sem certificação.' });
    }
    if (c.certified && c.severity === 'CRITICAL') {
      out.push({ flow: c.flow, code: 'CERTIFICATION_INTEGRITY_GAP', detail: 'Certificado com severity CRITICAL.' });
    }
  }
  return out;
}

export function rankIsolationCertification(
  certs: readonly IsolationCertification[],
): readonly IsolationCertification[] {
  const classOrder: Record<IsolationClassification, number> = {
    FULLY_ISOLATED: 0, CONTAINED: 1, BOUNDARY_SHARED: 2, LEAKING: 3, COLLAPSED: 4,
  };
  return [...certs].sort((a, b) => {
    if (a.certified !== b.certified) return a.certified ? -1 : 1;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    const co = classOrder[a.classification] - classOrder[b.classification];
    if (co !== 0) return co;
    const sv = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (sv !== 0) return sv;
    return a.flow.localeCompare(b.flow);
  });
}
