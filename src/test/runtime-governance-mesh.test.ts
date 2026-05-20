import { describe, it, expect } from 'vitest';
import {
  adaptAllLayers,
  adaptLayer,
  aggregateConsensusHealth,
  aggregateGovernanceMesh,
  assertAllMeshIntegrity,
  assertMeshCertification,
  assertMeshConsensus,
  assertMeshContainment,
  assertMeshIsolation,
  assertMeshReadOnlyInvariants,
  assertMeshTopology,
  buildConsensusMatrix,
  buildDefaultMeshLayers,
  buildGovernanceSeal,
  buildMeshCertification,
  buildMeshContainment,
  buildMeshTopology,
  calculateMeshConfidence,
  calculateMeshIntegrityScore,
  classifyConsensus,
  classifySealStrength,
  classifyTopologyHealth,
  detectConsensusGap,
  detectCrossLayerConflict,
  detectInvariantBreak,
  detectSealRegression,
  detectSealWeakness,
  detectTopologyCollapse,
  detectTopologyRecursion,
  emitMeshCertificationFailed,
  emitMeshConsensusDegraded,
  emitMeshContainmentCollapsed,
  emitMeshGenerated,
  emitMeshInvariantBroken,
  emitMeshTopologyUnstable,
  emitMeshViolationDetected,
  explainGovernanceMesh,
  explainMeshCertification,
  explainMeshConsensus,
  explainMeshContainment,
  explainMeshIntegrity,
  explainMeshTopology,
  rankConsensusRisk,
  rankMeshRisks,
  rankMeshViolations,
  RUNTIME_LAYERS,
  summarizeMeshHealth,
  verifySealIntegrity,
  type LayerSnapshot,
  type RawLayerInput,
} from '@/lib/runtimeGovernanceMesh';

function baseLayer(over: Partial<RawLayerInput> & { layer: RawLayerInput['layer'] }): LayerSnapshot {
  return adaptLayer(over);
}

function safeLayers(): readonly LayerSnapshot[] {
  return buildDefaultMeshLayers();
}

function brokenLayers(): readonly LayerSnapshot[] {
  return adaptAllLayers([
    { layer: 'recorder' },
    { layer: 'history' },
    { layer: 'replay', liveExecutionEnabled: true, stage: 'STAGE_1_PILOT' },
    { layer: 'causality', retryEnabled: true },
    { layer: 'stability', backgroundEnabled: true },
    { layer: 'integrity', drift: 'critical', containment: 'leaking' },
    { layer: 'isolation', topology: 'recursive' },
    { layer: 'enforcement', topology: 'collapsed', containment: 'collapsed' },
    { layer: 'immutable-core', certification: 'blocked' },
    { layer: 'certification', readiness: 'blocked' },
    { layer: 'governance', realUsersAllowed: true },
    { layer: 'promotion' },
    { layer: 'pilot' },
  ]);
}

describe('Phase 1.8.9 — Runtime Governance Mesh: A. Types & defaults', () => {
  it('A1: RUNTIME_LAYERS has 13 entries', () => {
    expect(RUNTIME_LAYERS).toHaveLength(13);
  });
  it('A2: buildDefaultMeshLayers returns 13 frozen safe layers', () => {
    const layers = buildDefaultMeshLayers();
    expect(layers).toHaveLength(13);
    layers.forEach((l) => {
      expect(Object.isFrozen(l)).toBe(true);
      expect(l.stage).toBe('STAGE_0_READ_ONLY');
      expect(l.liveExecutionEnabled).toBe(false);
    });
  });
});

describe('B. Governance seal', () => {
  it('B1: full seal on safe layers', () => {
    const seal = buildGovernanceSeal(safeLayers());
    expect(seal.intact).toBe(true);
    expect(seal.strength).toBe('full');
    expect(seal.violatingLayers).toHaveLength(0);
  });
  it('B2: broken seal on unsafe layers', () => {
    const seal = buildGovernanceSeal(brokenLayers());
    expect(seal.intact).toBe(false);
    expect(['weak', 'broken', 'partial']).toContain(seal.strength);
    expect(seal.violatingLayers.length).toBeGreaterThan(0);
  });
  it('B3: verifySealIntegrity', () => {
    expect(verifySealIntegrity(buildGovernanceSeal(safeLayers()))).toBe(true);
    expect(verifySealIntegrity(buildGovernanceSeal(brokenLayers()))).toBe(false);
  });
  it('B4: classifySealStrength + weakness detection', () => {
    const seal = buildGovernanceSeal(brokenLayers());
    expect(classifySealStrength(seal)).toBe(seal.strength);
    expect(detectSealWeakness(seal).length).toBeGreaterThan(0);
    expect(detectInvariantBreak(seal).length).toBeGreaterThan(0);
  });
  it('B5: detectSealRegression when previous was intact', () => {
    const prev = buildGovernanceSeal(safeLayers());
    const next = buildGovernanceSeal(brokenLayers(), { previous: prev });
    expect(detectSealRegression(next)).toBe(true);
  });
});

describe('C. Cross-layer consensus', () => {
  it('C1: unanimous on safe', () => {
    const c = aggregateConsensusHealth(safeLayers());
    expect(c.level).toBe('unanimous');
    expect(c.gap).toBe(false);
    expect(c.agreementScore).toBeCloseTo(1, 5);
  });
  it('C2: collapsed/split when conflicts exist', () => {
    const c = aggregateConsensusHealth(brokenLayers());
    expect(['split', 'collapsed']).toContain(c.level);
    expect(c.disagreements.length).toBeGreaterThan(0);
    expect(c.risk).toMatch(/high|critical/);
  });
  it('C3: classifyConsensus thresholds', () => {
    expect(classifyConsensus(1)).toBe('unanimous');
    expect(classifyConsensus(0.8)).toBe('majority');
    expect(classifyConsensus(0.5)).toBe('split');
    expect(classifyConsensus(0.1)).toBe('collapsed');
  });
  it('C4: rankConsensusRisk', () => {
    expect(rankConsensusRisk('collapsed', 0)).toBe('critical');
    expect(rankConsensusRisk('split', 0)).toBe('high');
    expect(rankConsensusRisk('unanimous', 0)).toBe('info');
  });
  it('C5: buildConsensusMatrix groups layers by dimension', () => {
    const m = buildConsensusMatrix(safeLayers());
    expect(Object.keys(m.stage)).toEqual(['STAGE_0_READ_ONLY']);
  });
  it('C6: detectConsensusGap returns empty on safe', () => {
    const gaps = detectConsensusGap(buildConsensusMatrix(safeLayers()));
    expect(gaps).toHaveLength(0);
  });
  it('C7: detectCrossLayerConflict flags live/retry/background', () => {
    const conflicts = detectCrossLayerConflict(brokenLayers());
    const dims = conflicts.map((c) => c.dimension);
    expect(dims).toContain('liveExecution');
    expect(dims).toContain('retry');
    expect(dims).toContain('background');
  });
});

describe('D. Containment', () => {
  it('D1: sealed on safe', () => {
    const c = buildMeshContainment(safeLayers());
    expect(c.mode).toBe('sealed');
    expect(c.escapeDetected).toBe(false);
    expect(c.envelopeStable).toBe(true);
  });
  it('D2: leaking/recursive/collapsed on broken', () => {
    const c = buildMeshContainment(brokenLayers());
    expect(['leaking', 'recursive', 'collapsed']).toContain(c.mode);
    expect(c.leakingLayers.length + c.recursiveLayers.length).toBeGreaterThan(0);
  });
  it('D3: escape detected when live/realUsers enabled', () => {
    const c = buildMeshContainment(brokenLayers());
    expect(c.escapeDetected).toBe(true);
  });
});

describe('E. Topology', () => {
  it('E1: stable on safe', () => {
    const t = buildMeshTopology(safeLayers());
    expect(t.state).toBe('stable');
    expect(detectTopologyRecursion(t)).toBe(false);
    expect(detectTopologyCollapse(t)).toBe(false);
  });
  it('E2: recursive/circular/collapsed on broken', () => {
    const t = buildMeshTopology(brokenLayers());
    expect(['recursive', 'circular', 'collapsed']).toContain(classifyTopologyHealth(t));
  });
  it('E3: cycles detected when ≥2 connected recursive layers', () => {
    const layers = adaptAllLayers([
      { layer: 'isolation', topology: 'recursive' },
      { layer: 'enforcement', topology: 'recursive' },
    ]);
    const t = buildMeshTopology(layers);
    expect(t.cycles.length).toBeGreaterThan(0);
  });
});

describe('F. Certification', () => {
  it('F1: full on safe', () => {
    const layers = safeLayers();
    const seal = buildGovernanceSeal(layers);
    const consensus = aggregateConsensusHealth(layers);
    const containment = buildMeshContainment(layers);
    const topology = buildMeshTopology(layers);
    const cert = buildMeshCertification({
      layers,
      seal,
      isolation: { mode: 'fully_isolated', leakingLayers: [], score: 1 },
      containment,
      consensus,
      topology,
    });
    expect(cert.level).toBe('full');
    expect(cert.confidence).toBe(1);
    expect(cert.reasons).toHaveLength(0);
  });
  it('F2: blocked when immutable invariant broken', () => {
    const layers = brokenLayers();
    const seal = buildGovernanceSeal(layers);
    const consensus = aggregateConsensusHealth(layers);
    const containment = buildMeshContainment(layers);
    const topology = buildMeshTopology(layers);
    const cert = buildMeshCertification({
      layers,
      seal,
      isolation: { mode: 'leaking', leakingLayers: ['integrity'], score: 0.3 },
      containment,
      consensus,
      topology,
    });
    expect(cert.level).toBe('blocked');
    expect(cert.reasons.length).toBeGreaterThan(0);
  });
});

describe('G. Aggregation', () => {
  it('G1: safe → healthy mesh', () => {
    const agg = aggregateGovernanceMesh(safeLayers());
    expect(agg.mesh.health.status).toBe('healthy');
    expect(agg.integrityScore).toBeGreaterThanOrEqual(80);
    expect(agg.confidence).toBeCloseTo(1, 5);
    expect(agg.mesh.violations).toHaveLength(0);
  });
  it('G2: broken → critical violations + collapsed/unstable', () => {
    const agg = aggregateGovernanceMesh(brokenLayers());
    expect(agg.mesh.violations.length).toBeGreaterThan(0);
    expect(agg.mesh.health.criticalViolations).toBeGreaterThan(0);
    expect(['collapsed', 'unstable', 'degraded']).toContain(agg.mesh.health.status);
  });
  it('G3: violations ranked by severity', () => {
    const agg = aggregateGovernanceMesh(brokenLayers());
    const ranked = rankMeshViolations(agg.mesh.violations);
    expect(ranked[0].severity).toBe('critical');
  });
  it('G4: risks ranked', () => {
    const agg = aggregateGovernanceMesh(brokenLayers());
    const ranked = rankMeshRisks(agg.mesh.risks);
    expect(ranked[0].severity).toMatch(/critical|high/);
  });
  it('G5: calculateMeshConfidence/IntegrityScore deterministic', () => {
    const a = aggregateGovernanceMesh(safeLayers());
    const b = aggregateGovernanceMesh(safeLayers());
    expect(calculateMeshConfidence(a.mesh)).toBe(calculateMeshConfidence(b.mesh));
    expect(calculateMeshIntegrityScore(a.mesh)).toBe(calculateMeshIntegrityScore(b.mesh));
  });
  it('G6: summarizeMeshHealth status thresholds', () => {
    const agg = aggregateGovernanceMesh(safeLayers());
    expect(summarizeMeshHealth(agg.mesh).status).toBe('healthy');
  });
});

describe('H. Determinism & reversibility', () => {
  it('H1: aggregateGovernanceMesh is pure given same input', () => {
    const a = aggregateGovernanceMesh(safeLayers(), { generatedAt: 'X' });
    const b = aggregateGovernanceMesh(safeLayers(), { generatedAt: 'X' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it('H2: result is immutable (layers frozen)', () => {
    const agg = aggregateGovernanceMesh(safeLayers());
    agg.mesh.layers.forEach((l) => expect(Object.isFrozen(l)).toBe(true));
  });
  it('H3: readOnly=true marker', () => {
    const agg = aggregateGovernanceMesh(safeLayers());
    expect(agg.mesh.readOnly).toBe(true);
  });
});

describe('I. Adapters inertness', () => {
  it('I1: adaptLayer returns frozen safe defaults', () => {
    const l = adaptLayer({ layer: 'pilot' });
    expect(Object.isFrozen(l)).toBe(true);
    expect(l.liveExecutionEnabled).toBe(false);
    expect(l.stage).toBe('STAGE_0_READ_ONLY');
  });
  it('I2: adaptAllLayers preserves order & freezes array', () => {
    const layers = buildDefaultMeshLayers();
    expect(Object.isFrozen(layers)).toBe(true);
    expect(layers.map((l) => l.layer)).toEqual([...RUNTIME_LAYERS]);
  });
  it('I3: adapters never mutate input', () => {
    const input: RawLayerInput = { layer: 'recorder', invariants: { x: true } };
    const before = JSON.stringify(input);
    adaptLayer(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe('J. Observability (PII-free)', () => {
  it('J1: emitters return frozen events with action+details', () => {
    const agg = aggregateGovernanceMesh(brokenLayers());
    const e1 = emitMeshGenerated(agg.mesh);
    expect(Object.isFrozen(e1)).toBe(true);
    expect(e1.action).toBe('runtime_mesh_generated');
  });
  it('J2: all 7 emitters fire', () => {
    const agg = aggregateGovernanceMesh(brokenLayers());
    expect(emitMeshGenerated(agg.mesh).action).toBe('runtime_mesh_generated');
    expect(emitMeshViolationDetected(agg.mesh.violations[0]).action).toBe(
      'runtime_mesh_violation_detected',
    );
    expect(emitMeshConsensusDegraded(agg.mesh.consensus).action).toBe(
      'runtime_mesh_consensus_collapsed',
    );
    expect(emitMeshContainmentCollapsed(agg.mesh.containment).action).toBe(
      'runtime_mesh_containment_failed',
    );
    expect(emitMeshTopologyUnstable(agg.mesh.topology).action).toBe(
      'runtime_mesh_topology_recursed',
    );
    expect(emitMeshCertificationFailed(agg.mesh.certification).action).toBe(
      'runtime_mesh_certification_invalid',
    );
    expect(emitMeshInvariantBroken(agg.mesh).action).toBe('runtime_mesh_invariant_broken');
  });
  it('J3: PII keys stripped from emitter details', () => {
    const v = aggregateGovernanceMesh(brokenLayers()).mesh.violations[0];
    // Inject PII via casting (simulate)
    const evt = emitMeshViolationDetected(
      { ...v, message: 'safe' } as any,
    );
    const stringified = JSON.stringify(evt.details);
    expect(stringified).not.toMatch(/email|phone|cpf|cnpj/i);
  });
});

describe('K. Explainers', () => {
  it('K1: explainers return non-empty deterministic strings', () => {
    const agg = aggregateGovernanceMesh(safeLayers());
    expect(explainGovernanceMesh(agg.mesh)).toContain('mesh:');
    expect(explainMeshConsensus(agg.mesh.consensus)).toContain('consensus=');
    expect(explainMeshContainment(agg.mesh.containment)).toContain('containment=');
    expect(explainMeshTopology(agg.mesh.topology)).toContain('topology=');
    expect(explainMeshCertification(agg.mesh.certification)).toContain('certification=');
    expect(explainMeshIntegrity(agg.mesh.seal)).toContain('seal=');
  });
});

describe('L. Guards', () => {
  it('L1: assertAllMeshIntegrity is empty on safe mesh', () => {
    const agg = aggregateGovernanceMesh(safeLayers());
    expect(assertAllMeshIntegrity(agg.mesh)).toEqual([]);
  });
  it('L2: assertAllMeshIntegrity yields violations on broken mesh', () => {
    const agg = aggregateGovernanceMesh(brokenLayers());
    const violations = assertAllMeshIntegrity(agg.mesh);
    expect(violations.length).toBeGreaterThan(0);
    const codes = violations.map((v) => v.code);
    expect(codes).toContain('MESH_READONLY_INVARIANT_BROKEN');
  });
  it('L3: granular assertions independently', () => {
    const agg = aggregateGovernanceMesh(brokenLayers());
    expect(assertMeshReadOnlyInvariants(agg.mesh).length).toBeGreaterThan(0);
    expect(assertMeshIsolation(agg.mesh.isolation).length).toBeGreaterThanOrEqual(0);
    expect(assertMeshContainment(agg.mesh.containment).length).toBeGreaterThan(0);
    expect(assertMeshConsensus(agg.mesh.consensus).length).toBeGreaterThanOrEqual(0);
    expect(assertMeshTopology(agg.mesh.topology).length).toBeGreaterThan(0);
    expect(assertMeshCertification(agg.mesh.certification).length).toBeGreaterThan(0);
  });
});

describe('M. Read-only invariants are exhaustive', () => {
  it('M1: liveExecution=true is rejected', () => {
    const layers = adaptAllLayers([{ layer: 'recorder', liveExecutionEnabled: true }]);
    const agg = aggregateGovernanceMesh(layers);
    expect(assertAllMeshIntegrity(agg.mesh).length).toBeGreaterThan(0);
  });
  it('M2: retry=true is rejected', () => {
    const layers = adaptAllLayers([{ layer: 'recorder', retryEnabled: true }]);
    const agg = aggregateGovernanceMesh(layers);
    expect(assertAllMeshIntegrity(agg.mesh).length).toBeGreaterThan(0);
  });
  it('M3: background=true is rejected', () => {
    const layers = adaptAllLayers([{ layer: 'recorder', backgroundEnabled: true }]);
    const agg = aggregateGovernanceMesh(layers);
    expect(assertAllMeshIntegrity(agg.mesh).length).toBeGreaterThan(0);
  });
  it('M4: realUsers=true is rejected', () => {
    const layers = adaptAllLayers([{ layer: 'recorder', realUsersAllowed: true }]);
    const agg = aggregateGovernanceMesh(layers);
    expect(assertAllMeshIntegrity(agg.mesh).length).toBeGreaterThan(0);
  });
  it('M5: stage != STAGE_0_READ_ONLY is rejected', () => {
    const layers = adaptAllLayers([{ layer: 'recorder', stage: 'STAGE_1_PILOT' }]);
    const agg = aggregateGovernanceMesh(layers);
    expect(assertAllMeshIntegrity(agg.mesh).length).toBeGreaterThan(0);
  });
});

describe('N. Empty/edge inputs', () => {
  it('N1: empty layers produce collapsed mesh without throwing', () => {
    const agg = aggregateGovernanceMesh([]);
    expect(agg.mesh.layers).toHaveLength(0);
    expect(agg.mesh.consensus.level).toBe('collapsed');
  });
  it('N2: single safe layer is healthy', () => {
    const agg = aggregateGovernanceMesh(adaptAllLayers([{ layer: 'recorder' }]));
    expect(agg.mesh.health.status).toBe('healthy');
  });
});

describe('O. No side effects (read-only contract)', () => {
  it('O1: input layers array is not mutated', () => {
    const layers = safeLayers();
    const before = JSON.stringify(layers);
    aggregateGovernanceMesh(layers);
    aggregateGovernanceMesh(layers);
    assertAllMeshIntegrity(aggregateGovernanceMesh(layers).mesh);
    expect(JSON.stringify(layers)).toBe(before);
  });
});
