import { aggregateConsensusHealth } from './crossLayerConsensus';
import { buildGovernanceSeal } from './governanceSeal';
import { buildMeshCertification } from './meshCertification';
import { buildMeshContainment } from './meshContainment';
import { buildMeshTopology } from './meshTopology';
import type {
  LayerSnapshot,
  MeshAggregation,
  MeshHealth,
  MeshIsolationState,
  MeshRisk,
  MeshSeverity,
  MeshViolation,
  RuntimeGovernanceMesh,
} from './meshTypes';

function deriveIsolation(layers: readonly LayerSnapshot[]): MeshIsolationState {
  const leakingLayers = layers
    .filter((l) => l.containment === 'leaking' || l.containment === 'collapsed')
    .map((l) => l.layer);
  const ratio = layers.length === 0 ? 0 : leakingLayers.length / layers.length;
  const score = Math.max(0, Math.min(1, 1 - ratio));
  let mode: MeshIsolationState['mode'];
  if (layers.length === 0) mode = 'collapsed';
  else if (leakingLayers.length === 0) mode = 'fully_isolated';
  else if (ratio < 0.25) mode = 'contained';
  else if (ratio < 0.5) mode = 'shared';
  else if (ratio < 1) mode = 'leaking';
  else mode = 'collapsed';
  return { mode, leakingLayers, score };
}

function severityWeight(s: MeshSeverity): number {
  return { info: 0, low: 1, medium: 3, high: 6, critical: 10 }[s];
}

export function rankMeshViolations(violations: readonly MeshViolation[]): readonly MeshViolation[] {
  return [...violations].sort(
    (a, b) => severityWeight(b.severity) - severityWeight(a.severity),
  );
}

export function rankMeshRisks(risks: readonly MeshRisk[]): readonly MeshRisk[] {
  return [...risks].sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity));
}

export function calculateMeshConfidence(mesh: RuntimeGovernanceMesh): number {
  const cert = mesh.certification.confidence;
  const consensus = mesh.consensus.agreementScore;
  const iso = mesh.isolation.score;
  const sealOk = mesh.seal.intact ? 1 : 0;
  return Math.max(0, Math.min(1, (cert + consensus + iso + sealOk) / 4));
}

export function calculateMeshIntegrityScore(mesh: RuntimeGovernanceMesh): number {
  const base = calculateMeshConfidence(mesh) * 100;
  const penalty = mesh.violations.reduce((acc, v) => acc + severityWeight(v.severity), 0);
  return Math.max(0, Math.min(100, Math.round(base - penalty)));
}

export function summarizeMeshHealth(mesh: RuntimeGovernanceMesh): MeshHealth {
  const score = calculateMeshIntegrityScore(mesh);
  const violationCount = mesh.violations.length;
  const criticalViolations = mesh.violations.filter((v) => v.severity === 'critical').length;
  let status: MeshHealth['status'];
  if (criticalViolations > 0 || score < 25) status = 'collapsed';
  else if (score < 50) status = 'unstable';
  else if (score < 80) status = 'degraded';
  else status = 'healthy';
  return { score, status, violationCount, criticalViolations };
}

export function aggregateGovernanceMesh(
  layers: readonly LayerSnapshot[],
  options?: { generatedAt?: string },
): MeshAggregation {
  const seal = buildGovernanceSeal(layers);
  const consensus = aggregateConsensusHealth(layers);
  const containment = buildMeshContainment(layers);
  const topology = buildMeshTopology(layers);
  const isolation = deriveIsolation(layers);
  const certification = buildMeshCertification({
    layers,
    seal,
    isolation,
    containment,
    consensus,
    topology,
  });

  const violations: MeshViolation[] = [];
  if (!seal.intact) {
    violations.push({
      code: 'MESH_READONLY_INVARIANT_BROKEN',
      severity: 'critical',
      layers: seal.violatingLayers,
      message: 'Governance seal broken: read-only invariant violated',
    });
    violations.push({
      code: 'MESH_SEAL_COMPROMISED',
      severity: 'critical',
      layers: seal.violatingLayers,
      message: `Seal strength=${seal.strength}`,
    });
  }
  if (consensus.level === 'collapsed') {
    violations.push({
      code: 'MESH_CONSENSUS_COLLAPSED',
      severity: 'critical',
      layers: layers.map((l) => l.layer),
      message: 'Cross-layer consensus collapsed',
    });
  }
  if (containment.escapeDetected || containment.leakingLayers.length > 0) {
    violations.push({
      code: 'MESH_CONTAINMENT_ESCAPE',
      severity: containment.mode === 'collapsed' ? 'critical' : 'high',
      layers: containment.leakingLayers,
      message: `Containment escape detected (mode=${containment.mode})`,
    });
  }
  if (isolation.mode === 'leaking' || isolation.mode === 'collapsed') {
    violations.push({
      code: 'MESH_ISOLATION_LEAK',
      severity: isolation.mode === 'collapsed' ? 'critical' : 'high',
      layers: isolation.leakingLayers,
      message: `Isolation compromised (mode=${isolation.mode})`,
    });
  }
  if (topology.cycles.length > 0 || topology.recursive) {
    violations.push({
      code: 'MESH_TOPOLOGY_RECURSION',
      severity: topology.cycles.length > 0 ? 'critical' : 'high',
      layers: topology.cycles[0] ?? [],
      message: 'Topology recursion detected',
    });
  }
  if (certification.level === 'blocked') {
    violations.push({
      code: 'MESH_CERTIFICATION_INVALID',
      severity: 'critical',
      layers: layers.map((l) => l.layer),
      message: `Mesh certification blocked: ${certification.reasons.join(',')}`,
    });
  }

  const risks: MeshRisk[] = violations.map((v, i) => ({
    id: `risk_${i}_${v.code}`,
    severity: v.severity,
    description: v.message,
    layers: v.layers,
  }));

  const mesh: RuntimeGovernanceMesh = {
    generatedAt: options?.generatedAt ?? '1970-01-01T00:00:00.000Z',
    layers,
    seal,
    consensus,
    containment,
    topology,
    isolation,
    certification,
    violations: rankMeshViolations(violations),
    risks: rankMeshRisks(risks),
    health: {
      score: 0,
      status: 'healthy',
      violationCount: violations.length,
      criticalViolations: violations.filter((v) => v.severity === 'critical').length,
    },
    readOnly: true,
  };

  // Now recompute health with full mesh
  const health = summarizeMeshHealth(mesh);
  const finalMesh: RuntimeGovernanceMesh = { ...mesh, health };

  const confidence = calculateMeshConfidence(finalMesh);
  const integrityScore = calculateMeshIntegrityScore(finalMesh);

  return {
    mesh: finalMesh,
    integrityScore,
    confidence,
    summary: `mesh=${finalMesh.health.status} cert=${finalMesh.certification.level} seal=${finalMesh.seal.strength} consensus=${finalMesh.consensus.level} score=${integrityScore}`,
  };
}
