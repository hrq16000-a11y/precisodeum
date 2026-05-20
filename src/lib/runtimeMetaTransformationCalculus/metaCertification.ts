// Phase 1.9.10 — Runtime Meta-Transformation Calculus · Certification
// Pure, deterministic certification sealing over transformation + topology + stability.

import type {
  MetaCertification,
  MetaRisk,
  MetaSeverity,
  RuntimeMetaTransformation,
} from './metaTransformationTypes';
import { buildMetaTopology } from './metaTopology';
import { buildMetaStability } from './metaStability';
import {
  computeMetaDeterminismSignature,
  isMetaTransformationDeterministic,
} from './metaDeterminism';
import { normalizeMetaTransformation } from './metaNormalization';

const STAGE_0 = 'STAGE_0_READ_ONLY' as const;

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const k of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[k]);
  }
  return value;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify((value as Record<string, unknown>)[k])).join(',') + '}';
}

function hash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return 'cert_' + h.toString(16).padStart(8, '0');
}

function risk(code: string, severity: MetaSeverity, description: string): MetaRisk {
  return deepFreeze({ code, severity, description });
}

export function detectMetaCertificationViolations(
  t: RuntimeMetaTransformation,
): readonly MetaRisk[] {
  const violations: MetaRisk[] = [];

  for (const c of t.components) {
    if (c.stage !== STAGE_0) {
      violations.push(risk('STAGE_INVARIANT_BROKEN', 'critical', `component ${c.id} stage != STAGE_0_READ_ONLY`));
    }
    if (c.liveExecutionEnabled) violations.push(risk('LIVE_EXECUTION_ENABLED', 'critical', `component ${c.id}`));
    if (c.retryEnabled) violations.push(risk('RETRY_ENABLED', 'error', `component ${c.id}`));
    if (c.backgroundEnabled) violations.push(risk('BACKGROUND_ENABLED', 'error', `component ${c.id}`));
    if (c.realUsersAllowed) violations.push(risk('REAL_USERS_ALLOWED', 'critical', `component ${c.id}`));
  }

  if (t.collapsed) violations.push(risk('TRANSFORMATION_COLLAPSED', 'critical', 'transformation collapsed'));
  if (t.class === 'BROKEN') violations.push(risk('CLASS_BROKEN', 'error', 'transformation class=BROKEN'));
  if (t.class === 'DEGENERATE') violations.push(risk('CLASS_DEGENERATE', 'warn', 'transformation class=DEGENERATE'));

  const topo = buildMetaTopology(t);
  if (topo.collapsed) violations.push(risk('TOPOLOGY_COLLAPSED', 'critical', 'topology collapsed'));
  if (topo.unstable) violations.push(risk('TOPOLOGY_UNSTABLE', 'error', 'topology unstable'));

  const stab = buildMetaStability(t);
  if (stab.collapsed) violations.push(risk('STABILITY_COLLAPSED', 'critical', 'stability collapsed'));
  if (stab.unstable) violations.push(risk('STABILITY_UNSTABLE', 'error', 'stability unstable'));

  const det = isMetaTransformationDeterministic(t);
  if (det.mutationLeakage) violations.push(risk('MUTATION_LEAKAGE', 'critical', 'mutation leakage detected'));
  if (det.verdict === 'UNSTABLE') violations.push(risk('NONDETERMINISTIC', 'error', 'determinism verdict=UNSTABLE'));

  if (!Object.isFrozen(t) || !Object.isFrozen(t.components)) {
    violations.push(risk('ENVELOPE_NOT_FROZEN', 'critical', 'transformation envelope not frozen'));
  }

  return deepFreeze(
    violations.slice().sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0)),
  );
}

export function computeMetaCertificationStrength(t: RuntimeMetaTransformation): number {
  const stab = buildMetaStability(t);
  const topo = buildMetaTopology(t);
  const violations = detectMetaCertificationViolations(t);
  let penalty = 0;
  for (const v of violations) {
    if (v.severity === 'critical') penalty += 0.4;
    else if (v.severity === 'error') penalty += 0.2;
    else if (v.severity === 'warn') penalty += 0.05;
  }
  const base = stab.score * 0.6 + topo.connectivity * 0.25 + t.score * 0.15;
  const result = base - penalty;
  const clamped = result < 0 ? 0 : result > 1 ? 1 : result;
  return Math.round(clamped * 1e6) / 1e6;
}

export function buildMetaCertification(t: RuntimeMetaTransformation): MetaCertification {
  const violations = detectMetaCertificationViolations(t);
  const confidence = computeMetaCertificationStrength(t);
  const hasCritical = violations.some((v) => v.severity === 'critical');
  const hasError = violations.some((v) => v.severity === 'error');
  let rank: 'OK' | 'WARN' | 'BLOCKED';
  if (hasCritical) rank = 'BLOCKED';
  else if (hasError || confidence < 0.6) rank = 'WARN';
  else rank = 'OK';
  const safe = rank === 'OK' && confidence >= 0.7;
  const reasons = Object.freeze(violations.map((v) => v.code));
  const cert: MetaCertification = deepFreeze({ safe, confidence, rank, reasons });
  return cert;
}

export function certifyMetaTransformation(t: RuntimeMetaTransformation): MetaCertification {
  return buildMetaCertification(t);
}

export function isMetaCertificationValid(t: RuntimeMetaTransformation): boolean {
  const cert = buildMetaCertification(t);
  return cert.safe && cert.rank === 'OK';
}

export function computeMetaCertificationSignature(t: RuntimeMetaTransformation): string {
  const cert = buildMetaCertification(t);
  const sig = computeMetaDeterminismSignature(normalizeMetaTransformation(t));
  return hash(stableStringify({ s: sig, c: cert.confidence, r: cert.rank, k: cert.safe, x: cert.reasons }));
}

export const __meta_certification_internals = deepFreeze({
  stage: STAGE_0,
  liveExecutionEnabled: false,
  retryEnabled: false,
  backgroundEnabled: false,
  realUsersAllowed: false,
});
