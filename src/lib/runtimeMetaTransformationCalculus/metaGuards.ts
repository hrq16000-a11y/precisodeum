// Phase 1.9.10 — Runtime Meta-Transformation Calculus · Guards
// Pure, deterministic, read-only invariant assertions. No side-effects.

import type {
  MetaCertification,
  MetaComponent,
  RuntimeMetaAggregate,
  RuntimeMetaComposition,
  RuntimeMetaEnvelope,
  RuntimeMetaIdentity,
  RuntimeMetaStability,
  RuntimeMetaTopology,
  RuntimeMetaTransformation,
} from './metaTransformationTypes';
import { isMetaNormalizationIdempotent } from './metaNormalization';
import { isMetaTransformationDeterministic } from './metaDeterminism';
import { metaTransformationsEquivalent } from './metaEquivalence';

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

function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return 'mg_' + h.toString(16).padStart(8, '0');
}

export type MetaIntegrityClass = 'OK' | 'WARN' | 'CRITICAL';

export interface MetaGuardViolation {
  readonly code: string;
  readonly message: string;
  readonly target: string;
  readonly severity: 'info' | 'warn' | 'error' | 'critical';
  readonly signature: string;
}

export interface MetaGuardResult {
  readonly violations: readonly MetaGuardViolation[];
  readonly integrity: MetaIntegrityClass;
  readonly signature: string;
}

function violation(
  code: string,
  message: string,
  target: string,
  severity: MetaGuardViolation['severity'],
): MetaGuardViolation {
  const sig = fnv1a(code + '|' + target + '|' + message);
  return deepFreeze({ code, message, target, severity, signature: sig });
}

function sortViolations(list: readonly MetaGuardViolation[]): readonly MetaGuardViolation[] {
  const cloned = list.slice();
  cloned.sort((a, b) => {
    if (a.code !== b.code) return a.code < b.code ? -1 : 1;
    if (a.target !== b.target) return a.target < b.target ? -1 : 1;
    return a.message < b.message ? -1 : a.message > b.message ? 1 : 0;
  });
  return Object.freeze(cloned);
}

function dedupe(list: readonly MetaGuardViolation[]): readonly MetaGuardViolation[] {
  const seen = new Set<string>();
  const out: MetaGuardViolation[] = [];
  for (const v of list) {
    const key = v.code + '|' + v.target + '|' + v.message;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(v);
    }
  }
  return Object.freeze(out);
}

function checkComponentFlags(c: MetaComponent, target: string): readonly MetaGuardViolation[] {
  const out: MetaGuardViolation[] = [];
  if (c.stage !== STAGE_0) out.push(violation('META_STAGE_ESCALATION', 'stage must be STAGE_0_READ_ONLY', target, 'critical'));
  if (c.liveExecutionEnabled) out.push(violation('META_LIVE_EXECUTION_ENABLED', 'live execution must be disabled', target, 'critical'));
  if (c.retryEnabled) out.push(violation('META_RETRY_ENABLED', 'retry must be disabled', target, 'critical'));
  if (c.backgroundEnabled) out.push(violation('META_BACKGROUND_ENABLED', 'background must be disabled', target, 'critical'));
  if (c.realUsersAllowed) out.push(violation('META_REAL_USERS_ENABLED', 'real users must not be allowed', target, 'critical'));
  return out;
}

export function assertMetaReadonlyInvariant(t: RuntimeMetaTransformation): readonly MetaGuardViolation[] {
  const out: MetaGuardViolation[] = [];
  for (const c of t.components) {
    out.push(...checkComponentFlags(c, 'component:' + c.id));
  }
  return sortViolations(out);
}

export function assertMetaFreezeInvariant(t: RuntimeMetaTransformation): readonly MetaGuardViolation[] {
  const out: MetaGuardViolation[] = [];
  if (!Object.isFrozen(t)) out.push(violation('META_NOT_FROZEN', 'transformation envelope not frozen', 'transformation', 'critical'));
  if (!Object.isFrozen(t.components)) out.push(violation('META_NOT_FROZEN', 'components array not frozen', 'transformation.components', 'critical'));
  for (const c of t.components) {
    if (!Object.isFrozen(c)) out.push(violation('META_NOT_FROZEN', 'component not frozen', 'component:' + c.id, 'critical'));
  }
  return sortViolations(out);
}

export function assertMetaDeterministicInvariant(t: RuntimeMetaTransformation): readonly MetaGuardViolation[] {
  const out: MetaGuardViolation[] = [];
  const det = isMetaTransformationDeterministic(t);
  if (det.verdict === 'UNSTABLE' || det.verdict === 'EVENTUAL') {
    out.push(violation('META_DETERMINISM_REGRESSION', 'determinism verdict ' + det.verdict, 'transformation', det.verdict === 'UNSTABLE' ? 'critical' : 'error'));
  }
  if (det.mutationLeakage) {
    out.push(violation('META_READONLY_BROKEN', 'mutation leakage detected', 'transformation', 'critical'));
  }
  return sortViolations(out);
}

export function assertMetaTopologyInvariant(topology: RuntimeMetaTopology): readonly MetaGuardViolation[] {
  const out: MetaGuardViolation[] = [];
  if (topology.collapsed) out.push(violation('META_TOPOLOGY_UNSTABLE', 'topology collapsed', 'topology', 'critical'));
  else if (topology.unstable) out.push(violation('META_TOPOLOGY_UNSTABLE', 'topology unstable', 'topology', 'error'));
  return sortViolations(out);
}

export function assertMetaCertificationInvariant(cert: MetaCertification): readonly MetaGuardViolation[] {
  const out: MetaGuardViolation[] = [];
  if (cert.rank === 'BLOCKED' || !cert.safe) {
    out.push(violation('META_CERTIFICATION_INVALID', 'certification ' + cert.rank, 'certification', 'critical'));
  } else if (cert.rank === 'WARN') {
    out.push(violation('META_CERTIFICATION_INVALID', 'certification WARN', 'certification', 'warn'));
  }
  return sortViolations(out);
}

export function assertMetaObservabilityInvariant(payload: unknown, target = 'observability'): readonly MetaGuardViolation[] {
  const out: MetaGuardViolation[] = [];
  const json = stableStringify(payload);
  const sensitive = /"(email|cpf|cnpj|token|password|secret|phone|whatsapp)"\s*:/i;
  if (sensitive.test(json)) {
    out.push(violation('META_OBSERVABILITY_LEAK', 'sensitive field detected in observability payload', target, 'critical'));
  }
  return sortViolations(out);
}

export function assertMetaEquivalenceInvariant(t: RuntimeMetaTransformation): readonly MetaGuardViolation[] {
  const out: MetaGuardViolation[] = [];
  const sym = metaTransformationsEquivalent(t, t, 'STRUCTURAL');
  if (!sym.equivalent) {
    out.push(violation('META_EQUIVALENCE_REGRESSION', 'self-equivalence failed', 'equivalence', 'critical'));
  }
  return sortViolations(out);
}

export function assertMetaStabilityInvariant(stability: RuntimeMetaStability): readonly MetaGuardViolation[] {
  const out: MetaGuardViolation[] = [];
  if (stability.collapsed) out.push(violation('META_STABILITY_COLLAPSED', 'stability collapsed', 'stability', 'critical'));
  else if (stability.unstable) out.push(violation('META_STABILITY_COLLAPSED', 'stability unstable', 'stability', 'error'));
  return sortViolations(out);
}

export function assertMetaCompositionInvariant(composition: RuntimeMetaComposition): readonly MetaGuardViolation[] {
  const out: MetaGuardViolation[] = [];
  if (composition.broken || composition.failed) {
    out.push(violation('META_COMPOSITION_INVALID', 'composition ' + composition.class, 'composition', composition.broken ? 'critical' : 'error'));
  }
  return sortViolations(out);
}

export function assertMetaNormalizationInvariant(t: RuntimeMetaTransformation): readonly MetaGuardViolation[] {
  const out: MetaGuardViolation[] = [];
  if (!isMetaNormalizationIdempotent(t)) {
    out.push(violation('META_NORMALIZATION_NON_IDEMPOTENT', 'normalization not idempotent', 'normalization', 'critical'));
  }
  return sortViolations(out);
}

export function assertMetaIdentityInvariant(identity: RuntimeMetaIdentity): readonly MetaGuardViolation[] {
  const out: MetaGuardViolation[] = [];
  if (identity.broken || identity.class === 'BROKEN') {
    out.push(violation('META_IDENTITY_BROKEN', 'identity broken', 'identity', 'critical'));
  }
  return sortViolations(out);
}

export function assertMetaAggregateInvariant(agg: RuntimeMetaAggregate): readonly MetaGuardViolation[] {
  const out: MetaGuardViolation[] = [];
  if (!agg.stable) {
    out.push(violation('META_AGGREGATION_UNSTABLE', 'aggregate unstable', 'aggregate', 'error'));
  }
  if (!Object.isFrozen(agg) || !Object.isFrozen(agg.envelopes)) {
    out.push(violation('META_NOT_FROZEN', 'aggregate not frozen', 'aggregate', 'critical'));
  }
  return sortViolations(out);
}

export function assertAllMetaIntegrity(envelope: RuntimeMetaEnvelope): MetaGuardResult {
  const all: MetaGuardViolation[] = [];
  all.push(...assertMetaReadonlyInvariant(envelope.transformation));
  all.push(...assertMetaFreezeInvariant(envelope.transformation));
  all.push(...assertMetaDeterministicInvariant(envelope.transformation));
  all.push(...assertMetaTopologyInvariant(envelope.topology));
  all.push(...assertMetaCertificationInvariant(envelope.certification));
  all.push(...assertMetaEquivalenceInvariant(envelope.transformation));
  all.push(...assertMetaStabilityInvariant(envelope.stability));
  all.push(...assertMetaCompositionInvariant(envelope.composition));
  all.push(...assertMetaNormalizationInvariant(envelope.transformation));
  all.push(...assertMetaIdentityInvariant(envelope.identity));

  const unique = dedupe(sortViolations(all));
  let integrity: MetaIntegrityClass = 'OK';
  for (const v of unique) {
    if (v.severity === 'critical') { integrity = 'CRITICAL'; break; }
    if (v.severity === 'error' || v.severity === 'warn') integrity = 'WARN';
  }
  const signature = fnv1a(stableStringify(unique));
  return deepFreeze({ violations: unique, integrity, signature });
}

export const __meta_guards_internals = deepFreeze({
  stage: STAGE_0,
  liveExecutionEnabled: false,
  retryEnabled: false,
  backgroundEnabled: false,
  realUsersAllowed: false,
});
