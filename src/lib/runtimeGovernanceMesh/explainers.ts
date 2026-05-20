import type {
  GovernanceSeal,
  MeshCertification,
  MeshConsensus,
  MeshContainment,
  MeshTopology,
  RuntimeGovernanceMesh,
} from './meshTypes';

export function explainGovernanceMesh(mesh: RuntimeGovernanceMesh): string {
  return [
    `mesh: layers=${mesh.layers.length}`,
    `seal=${mesh.seal.strength}`,
    `consensus=${mesh.consensus.level}`,
    `containment=${mesh.containment.mode}`,
    `topology=${mesh.topology.state}`,
    `certification=${mesh.certification.level}`,
    `health=${mesh.health.status}(${mesh.health.score})`,
    `violations=${mesh.violations.length}`,
  ].join(' | ');
}

export function explainMeshConsensus(c: MeshConsensus): string {
  return `consensus=${c.level} agreement=${c.agreementScore.toFixed(2)} gaps=${c.disagreements.length} risk=${c.risk}`;
}

export function explainMeshContainment(c: MeshContainment): string {
  return `containment=${c.mode} leaks=${c.leakingLayers.length} recursive=${c.recursiveLayers.length} escape=${c.escapeDetected}`;
}

export function explainMeshTopology(t: MeshTopology): string {
  return `topology=${t.state} overlaps=${t.overlaps.length} cycles=${t.cycles.length} recursive=${t.recursive}`;
}

export function explainMeshCertification(c: MeshCertification): string {
  return `certification=${c.level} confidence=${c.confidence.toFixed(2)} reasons=[${c.reasons.join(',')}]`;
}

export function explainMeshIntegrity(seal: GovernanceSeal): string {
  return `seal=${seal.strength} intact=${seal.intact} violators=${seal.violatingLayers.length} regression=${seal.regression}`;
}
