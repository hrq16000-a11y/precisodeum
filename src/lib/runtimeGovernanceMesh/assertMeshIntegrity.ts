import {
  assertMeshCertification,
  assertMeshConsensus,
  assertMeshContainment,
  assertMeshIntegrity,
  assertMeshIsolation,
  assertMeshReadOnlyInvariants,
  assertMeshTopology,
  type MeshGuardViolation,
} from './meshGuards';
import type { RuntimeGovernanceMesh } from './meshTypes';

export function assertAllMeshIntegrity(
  mesh: RuntimeGovernanceMesh,
): readonly MeshGuardViolation[] {
  const collected: MeshGuardViolation[] = [];
  collected.push(...assertMeshReadOnlyInvariants(mesh));
  collected.push(...assertMeshIsolation(mesh.isolation));
  collected.push(...assertMeshContainment(mesh.containment));
  collected.push(...assertMeshConsensus(mesh.consensus));
  collected.push(...assertMeshTopology(mesh.topology));
  collected.push(...assertMeshCertification(mesh.certification));
  collected.push(...assertMeshIntegrity(mesh));

  // De-duplicate by code+message
  const seen = new Set<string>();
  const unique: MeshGuardViolation[] = [];
  for (const v of collected) {
    const key = `${v.code}|${v.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(v);
    }
  }
  return Object.freeze(unique);
}
