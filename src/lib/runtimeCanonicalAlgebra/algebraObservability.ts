import type {
  CanonicalRuntimeGraph,
  RuntimeAlgebraViolation,
  RuntimeCanonicalCertification,
  RuntimeDeterminism,
  RuntimeReduction,
  RuntimeNormalization,
} from './algebraTypes';

const PII_KEYS = new Set([
  'email', 'phone', 'cpf', 'cnpj', 'city', 'address', 'name',
  'payload', 'raw', 'json', 'url', 'ip',
]);

function sanitize<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => sanitize(v)) as unknown as T;
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (PII_KEYS.has(k.toLowerCase())) continue;
      out[k] = sanitize(v);
    }
    return out as T;
  }
  return value;
}

export interface AlgebraEvent {
  readonly action: string;
  readonly details: Readonly<Record<string, unknown>>;
}

function event(action: string, details: Record<string, unknown>): AlgebraEvent {
  try {
    return Object.freeze({ action, details: Object.freeze(sanitize(details)) });
  } catch {
    return Object.freeze({ action, details: Object.freeze({}) });
  }
}

export function emitAlgebraGenerated(g: CanonicalRuntimeGraph): AlgebraEvent {
  return event('runtime_algebra_generated', {
    nodes: g.nodes.length,
    edges: g.edges.length,
    certification: g.certification.level,
    health: g.health.status,
    score: g.health.score,
  });
}

export function emitAlgebraViolationDetected(v: RuntimeAlgebraViolation): AlgebraEvent {
  return event('runtime_algebra_violation_detected', {
    code: v.code,
    severity: v.severity,
    nodeCount: v.nodes.length,
  });
}

export function emitAlgebraNonDeterminismDetected(d: RuntimeDeterminism): AlgebraEvent {
  return event('runtime_algebra_nondeterminism_detected', {
    level: d.level,
    variance: d.varianceCount,
    nodes: d.nonDeterministicNodes.length,
  });
}

export function emitAlgebraCompositionConflict(g: CanonicalRuntimeGraph): AlgebraEvent {
  return event('runtime_algebra_composition_conflict', {
    classification: g.composition.classification,
    conflicts: g.composition.conflicts.length,
    explosion: g.composition.explosion,
  });
}

export function emitAlgebraReductionFailed(r: RuntimeReduction): AlgebraEvent {
  return event('runtime_algebra_reduction_failed', {
    mode: r.mode,
    gain: r.gain,
    original: r.originalNodes,
    reduced: r.reducedNodes,
  });
}

export function emitAlgebraCertificationInvalid(c: RuntimeCanonicalCertification): AlgebraEvent {
  return event('runtime_algebra_certification_invalid', {
    level: c.level,
    confidence: c.confidence,
    reasons: c.reasons,
  });
}

export function emitAlgebraInvariantBroken(g: CanonicalRuntimeGraph): AlgebraEvent {
  return event('runtime_algebra_invariant_broken', {
    sealed: g.envelope.sealed,
    violators: g.envelope.violators.length,
    invariantsBroken: g.envelope.invariants.filter((i) => !i.satisfied).map((i) => i.name),
  });
}

export function explainAlgebra(g: CanonicalRuntimeGraph): string {
  return [
    `algebra: nodes=${g.nodes.length}`,
    `edges=${g.edges.length}`,
    `topology=${g.topology.state}`,
    `determinism=${g.determinism.level}`,
    `composition=${g.composition.classification}`,
    `reduction=${g.reduction.mode}`,
    `normalization=${g.normalization.mode}`,
    `certification=${g.certification.level}`,
    `health=${g.health.status}(${g.health.score})`,
    `violations=${g.violations.length}`,
  ].join(' | ');
}

export function explainDeterminism(d: RuntimeDeterminism): string {
  return `determinism=${d.level} variance=${d.varianceCount} nondet=${d.nonDeterministicNodes.length} temporal=${d.temporalInstability}`;
}

export function explainNormalization(n: RuntimeNormalization): string {
  return `normalization=${n.mode} hash=${n.canonicalHash} conflicts=${n.conflicts.length}`;
}

export function explainReduction(r: RuntimeReduction): string {
  return `reduction=${r.mode} gain=${r.gain.toFixed(2)} (${r.originalNodes}→${r.reducedNodes})`;
}

export function explainCertification(c: RuntimeCanonicalCertification): string {
  return `certification=${c.level} confidence=${c.confidence.toFixed(2)} reasons=[${c.reasons.join(',')}]`;
}

export function explainEnvelope(g: CanonicalRuntimeGraph): string {
  return `envelope=${g.envelope.sealed ? 'sealed' : 'broken'} violators=${g.envelope.violators.length}`;
}
