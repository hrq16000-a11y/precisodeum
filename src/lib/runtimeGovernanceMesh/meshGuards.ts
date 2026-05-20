import type {
  MeshCertification,
  MeshConsensus,
  MeshContainment,
  MeshIsolationState,
  MeshTopology,
  MeshViolation,
  MeshViolationCode,
  RuntimeGovernanceMesh,
} from './meshTypes';

export interface MeshGuardViolation {
  readonly code: MeshViolationCode;
  readonly message: string;
}

function v(code: MeshViolationCode, message: string): MeshGuardViolation {
  return Object.freeze({ code, message });
}

export function assertMeshIntegrity(mesh: RuntimeGovernanceMesh): readonly MeshGuardViolation[] {
  const out: MeshGuardViolation[] = [];
  if (!mesh.seal.intact) out.push(v('MESH_SEAL_COMPROMISED', 'Seal not intact'));
  if (mesh.violations.length > 0) {
    for (const violation of mesh.violations) {
      out.push(v(violation.code, violation.message));
    }
  }
  return out;
}

export function assertMeshIsolation(iso: MeshIsolationState): readonly MeshGuardViolation[] {
  if (iso.mode === 'leaking' || iso.mode === 'collapsed') {
    return [v('MESH_ISOLATION_LEAK', `Isolation mode=${iso.mode}`)];
  }
  return [];
}

export function assertMeshContainment(c: MeshContainment): readonly MeshGuardViolation[] {
  const out: MeshGuardViolation[] = [];
  if (c.escapeDetected) out.push(v('MESH_CONTAINMENT_ESCAPE', 'Escape detected'));
  if (c.mode === 'collapsed' || c.mode === 'leaking') {
    out.push(v('MESH_CONTAINMENT_ESCAPE', `Containment mode=${c.mode}`));
  }
  return out;
}

export function assertMeshConsensus(c: MeshConsensus): readonly MeshGuardViolation[] {
  if (c.level === 'collapsed') return [v('MESH_CONSENSUS_COLLAPSED', 'Consensus collapsed')];
  return [];
}

export function assertMeshTopology(t: MeshTopology): readonly MeshGuardViolation[] {
  if (t.cycles.length > 0 || t.collapsed) {
    return [v('MESH_TOPOLOGY_RECURSION', `Topology state=${t.state}`)];
  }
  return [];
}

export function assertMeshCertification(c: MeshCertification): readonly MeshGuardViolation[] {
  if (c.level === 'blocked') {
    return [v('MESH_CERTIFICATION_INVALID', `Certification blocked: ${c.reasons.join(',')}`)];
  }
  return [];
}

export function assertMeshReadOnlyInvariants(
  mesh: RuntimeGovernanceMesh,
): readonly MeshGuardViolation[] {
  const out: MeshGuardViolation[] = [];
  for (const l of mesh.layers) {
    if (l.liveExecutionEnabled || l.retryEnabled || l.backgroundEnabled || l.realUsersAllowed) {
      out.push(
        v('MESH_READONLY_INVARIANT_BROKEN', `Layer ${l.layer} broke read-only invariants`),
      );
    }
    if (l.stage !== 'STAGE_0_READ_ONLY') {
      out.push(
        v('MESH_READONLY_INVARIANT_BROKEN', `Layer ${l.layer} stage=${l.stage} (must be STAGE_0_READ_ONLY)`),
      );
    }
  }
  return out;
}

export type { MeshViolation };
