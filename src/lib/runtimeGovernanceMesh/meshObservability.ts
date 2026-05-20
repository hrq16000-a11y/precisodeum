/**
 * Fail-soft, PII-free mesh observability emitters.
 *
 * No I/O. No network. No timers. Returns sanitized events for callers to log.
 */

import type {
  MeshCertification,
  MeshConsensus,
  MeshContainment,
  MeshTopology,
  MeshViolation,
  RuntimeGovernanceMesh,
} from './meshTypes';

const PII_KEYS = new Set([
  'email',
  'phone',
  'cpf',
  'cnpj',
  'city',
  'address',
  'name',
  'payload',
  'raw',
  'json',
  'url',
  'ip',
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

export interface MeshEvent {
  readonly action: string;
  readonly details: Readonly<Record<string, unknown>>;
}

function event(action: string, details: Record<string, unknown>): MeshEvent {
  try {
    return Object.freeze({ action, details: Object.freeze(sanitize(details)) });
  } catch {
    return Object.freeze({ action, details: Object.freeze({}) });
  }
}

export function emitMeshGenerated(mesh: RuntimeGovernanceMesh): MeshEvent {
  return event('runtime_mesh_generated', {
    layerCount: mesh.layers.length,
    sealStrength: mesh.seal.strength,
    certification: mesh.certification.level,
    health: mesh.health.status,
    score: mesh.health.score,
  });
}

export function emitMeshViolationDetected(v: MeshViolation): MeshEvent {
  return event('runtime_mesh_violation_detected', {
    code: v.code,
    severity: v.severity,
    layerCount: v.layers.length,
  });
}

export function emitMeshConsensusDegraded(c: MeshConsensus): MeshEvent {
  return event('runtime_mesh_consensus_collapsed', {
    level: c.level,
    agreementScore: c.agreementScore,
    disagreements: c.disagreements.length,
    risk: c.risk,
  });
}

export function emitMeshContainmentCollapsed(c: MeshContainment): MeshEvent {
  return event('runtime_mesh_containment_failed', {
    mode: c.mode,
    leakingCount: c.leakingLayers.length,
    recursiveCount: c.recursiveLayers.length,
    escapeDetected: c.escapeDetected,
  });
}

export function emitMeshTopologyUnstable(t: MeshTopology): MeshEvent {
  return event('runtime_mesh_topology_recursed', {
    state: t.state,
    cycles: t.cycles.length,
    overlaps: t.overlaps.length,
    recursive: t.recursive,
    collapsed: t.collapsed,
  });
}

export function emitMeshCertificationFailed(c: MeshCertification): MeshEvent {
  return event('runtime_mesh_certification_invalid', {
    level: c.level,
    confidence: c.confidence,
    reasons: c.reasons,
  });
}

export function emitMeshInvariantBroken(mesh: RuntimeGovernanceMesh): MeshEvent {
  return event('runtime_mesh_invariant_broken', {
    sealStrength: mesh.seal.strength,
    violators: mesh.seal.violatingLayers.length,
    invariantsBroken: mesh.seal.invariants.filter((i) => !i.satisfied).map((i) => i.name),
  });
}
