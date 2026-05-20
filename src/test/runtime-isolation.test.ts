/**
 * Fase 1.8.6 — Runtime Isolation tests (READ-ONLY).
 * 30+ testes (A→Z + extras).
 */

import { describe, expect, it } from 'vitest';
import {
  ISOLATION_AUDIT_ACTIONS,
  adaptRuntimeLayersToBoundaries,
  aggregateBoundaryRisks,
  aggregateIsolation,
  aggregateIsolationLeaks,
  analyzeIsolationTopology,
  analyzePropagationIsolation,
  assertAllIsolationIntegrity,
  assertIsolationCertificationIntegrity,
  assertIsolationContainment,
  assertIsolationCoverage,
  assertIsolationDeterminism,
  assertIsolationObservabilityPurity,
  assertIsolationReadOnlyInvariant,
  assertIsolationTopologyIntegrity,
  assertNoIsolationLeakExpansion,
  buildBoundary,
  buildIsolationAuditPayload,
  buildIsolationCertification,
  buildIsolationEnvelope,
  buildIsolationRanking,
  calculateIsolationConfidence,
  calculateIsolationScore,
  calculateIsolationSeverity,
  classifyBoundaryIsolation,
  classifyIsolationSafety,
  classifyPropagationEnvelope,
  detectBoundaryLeak,
  detectCrossLayerDependency,
  detectHiddenCascadePropagation,
  detectIsolationCertificationGap,
  detectIsolationCollapse,
  detectPropagationLeak,
  detectRecursiveIsolationFailure,
  detectSharedBoundaryRisk,
  detectTopologyOverlap,
  detectTopologyOverlapLeak,
  detectTopologyRecursion,
  detectUnboundedPropagation,
  detectUnsafeTopologyCoupling,
  explainIsolation,
  explainIsolationAggregation,
  explainIsolationCertification,
  explainIsolationLeak,
  explainIsolationTopology,
  isIsolationAuditPayloadPiiFree,
  rankIsolationCertification,
  rankTopologyRisk,
  summarizeIsolationHealth,
} from '@/lib/runtimeIsolation';
import type {
  IsolationBoundary,
  IsolationEnvelope,
} from '@/lib/runtimeIsolation';
import type { FlowId } from '@/lib/operations/operationRegistry';

const FLOW: FlowId = 'dashboard_profile_save';
const FLOW2: FlowId = 'persist_first_service';

function fullyIsolatedBoundaries(): readonly IsolationBoundary[] {
  return [
    buildBoundary({ flow: FLOW, type: 'RUNTIME', intact: true }),
    buildBoundary({ flow: FLOW, type: 'REPLAY', intact: true }),
    buildBoundary({ flow: FLOW, type: 'CAUSALITY', intact: true }),
  ];
}

function buildEnvelopeFully(): IsolationEnvelope {
  const topology = analyzeIsolationTopology({ flow: FLOW, boundaries: fullyIsolatedBoundaries() });
  const propagation = analyzePropagationIsolation({ flow: FLOW, depth: 1, maxDepth: 5 });
  return buildIsolationEnvelope({ flow: FLOW, topology, leaks: [], propagation });
}

describe('Fase 1.8.6 — Runtime Isolation', () => {
  it('A. classifyBoundaryIsolation retorna FULLY_ISOLATED sem sharing', () => {
    expect(
      classifyBoundaryIsolation({ boundaries: fullyIsolatedBoundaries(), recursive: false, cascading: false }),
    ).toBe('FULLY_ISOLATED');
  });

  it('B. classifyBoundaryIsolation retorna CONTAINED com shared não-quebrado', () => {
    const bs = [
      buildBoundary({ flow: FLOW, type: 'RUNTIME', intact: true, sharedWith: ['REPLAY'] }),
      buildBoundary({ flow: FLOW, type: 'REPLAY', intact: true }),
    ];
    expect(classifyBoundaryIsolation({ boundaries: bs, recursive: false, cascading: false })).toBe('CONTAINED');
  });

  it('C. classifyBoundaryIsolation retorna BOUNDARY_SHARED com 1 quebrado', () => {
    const bs = [
      buildBoundary({ flow: FLOW, type: 'RUNTIME', intact: false }),
      buildBoundary({ flow: FLOW, type: 'REPLAY', intact: true }),
    ];
    expect(classifyBoundaryIsolation({ boundaries: bs, recursive: false, cascading: false })).toBe('BOUNDARY_SHARED');
  });

  it('D. classifyBoundaryIsolation retorna LEAKING com recursive', () => {
    expect(
      classifyBoundaryIsolation({ boundaries: fullyIsolatedBoundaries(), recursive: true, cascading: false }),
    ).toBe('LEAKING');
  });

  it('E. classifyBoundaryIsolation retorna COLLAPSED com recursive+cascading', () => {
    expect(
      classifyBoundaryIsolation({ boundaries: fullyIsolatedBoundaries(), recursive: true, cascading: true }),
    ).toBe('COLLAPSED');
  });

  it('F. liveExecutionEnabled força COLLAPSED', () => {
    expect(
      classifyBoundaryIsolation({ boundaries: fullyIsolatedBoundaries(), recursive: false, cascading: false, liveExecutionEnabled: true }),
    ).toBe('COLLAPSED');
  });

  it('G. detectRecursiveIsolationFailure detecta ciclo', () => {
    const bs = [
      buildBoundary({ flow: FLOW, type: 'RUNTIME', intact: true, sharedWith: ['REPLAY'] }),
      buildBoundary({ flow: FLOW, type: 'REPLAY', intact: true, sharedWith: ['RUNTIME'] }),
    ];
    expect(detectRecursiveIsolationFailure({ boundaries: bs })).toBe(true);
  });

  it('H. detectSharedBoundaryRisk com 2+ shared', () => {
    const bs = [
      buildBoundary({ flow: FLOW, type: 'RUNTIME', intact: true, sharedWith: ['REPLAY'] }),
      buildBoundary({ flow: FLOW, type: 'CAUSALITY', intact: true, sharedWith: ['STABILITY'] }),
    ];
    expect(detectSharedBoundaryRisk(bs)).toBe(true);
  });

  it('I. detectIsolationCollapse com live execution', () => {
    expect(detectIsolationCollapse({ recursive: false, cascading: false, liveExecutionEnabled: true })).toBe(true);
  });

  it('J. detectCrossLayerDependency true se shared', () => {
    const bs = [buildBoundary({ flow: FLOW, type: 'RUNTIME', intact: true, sharedWith: ['REPLAY'] })];
    expect(detectCrossLayerDependency(bs)).toBe(true);
  });

  it('K. classifyPropagationEnvelope: isolated/contained/leaking/collapsed', () => {
    expect(classifyPropagationEnvelope({ flow: FLOW, depth: 1, maxDepth: 5 })).toBe('isolated');
    expect(classifyPropagationEnvelope({ flow: FLOW, depth: 4, maxDepth: 5 })).toBe('contained');
    expect(classifyPropagationEnvelope({ flow: FLOW, depth: 10, maxDepth: 5 })).toBe('leaking');
    expect(classifyPropagationEnvelope({ flow: FLOW, depth: 1, maxDepth: 5, hiddenCascade: true, recursive: true })).toBe('collapsed');
  });

  it('L. detectUnboundedPropagation reflete depth>max', () => {
    const p = analyzePropagationIsolation({ flow: FLOW, depth: 99, maxDepth: 3 });
    expect(detectUnboundedPropagation(p)).toBe(true);
  });

  it('M. detectHiddenCascadePropagation', () => {
    const p = analyzePropagationIsolation({ flow: FLOW, depth: 1, maxDepth: 5, hiddenCascade: true });
    expect(detectHiddenCascadePropagation(p)).toBe(true);
  });

  it('N. detectPropagationLeak retorna null em isolated', () => {
    const p = analyzePropagationIsolation({ flow: FLOW, depth: 1 });
    expect(detectPropagationLeak(p)).toBeNull();
  });

  it('O. analyzeIsolationTopology calcula overlaps', () => {
    const t = analyzeIsolationTopology({
      flow: FLOW,
      boundaries: [
        buildBoundary({ flow: FLOW, type: 'RUNTIME', intact: true, sharedWith: ['REPLAY', 'CAUSALITY'] }),
      ],
    });
    expect(t.overlaps).toBe(2);
    expect(detectTopologyOverlap(t.boundaries)).toBe(2);
  });

  it('P. detectUnsafeTopologyCoupling em GOVERNANCE shared', () => {
    const bs = [buildBoundary({ flow: FLOW, type: 'GOVERNANCE', intact: true, sharedWith: ['RUNTIME'] })];
    expect(detectUnsafeTopologyCoupling(bs)).toBe(true);
  });

  it('Q. detectTopologyRecursion delega para boundary recursion', () => {
    const bs = [
      buildBoundary({ flow: FLOW, type: 'RUNTIME', intact: true, sharedWith: ['REPLAY'] }),
      buildBoundary({ flow: FLOW, type: 'REPLAY', intact: true, sharedWith: ['RUNTIME'] }),
    ];
    expect(detectTopologyRecursion(bs)).toBe(true);
  });

  it('R. rankTopologyRisk ordena por risco descendente', () => {
    const t1 = analyzeIsolationTopology({ flow: FLOW, boundaries: fullyIsolatedBoundaries() });
    const t2 = analyzeIsolationTopology({
      flow: FLOW2,
      boundaries: [
        buildBoundary({ flow: FLOW2, type: 'RUNTIME', intact: true, sharedWith: ['REPLAY'] }),
        buildBoundary({ flow: FLOW2, type: 'REPLAY', intact: true, sharedWith: ['RUNTIME'] }),
      ],
    });
    const ranked = rankTopologyRisk([t1, t2]);
    expect(ranked[0].flow).toBe(FLOW2);
  });

  it('S. detectTopologyOverlapLeak retorna null sem overlaps', () => {
    const t = analyzeIsolationTopology({ flow: FLOW, boundaries: fullyIsolatedBoundaries() });
    expect(detectTopologyOverlapLeak(FLOW, t)).toBeNull();
  });

  it('T. buildIsolationEnvelope FULLY_ISOLATED determinístico', () => {
    const e1 = buildEnvelopeFully();
    const e2 = buildEnvelopeFully();
    expect(e1.classification).toBe('FULLY_ISOLATED');
    expect(e1.score).toBe(e2.score);
    expect(e1.severity).toBe('NONE');
    expect(e1.liveExecutionEnabled).toBe(false);
    expect(e1.currentStage).toBe('STAGE_0_READ_ONLY');
  });

  it('U. buildIsolationEnvelope COLLAPSED com recursão+cascading', () => {
    const bs = [
      buildBoundary({ flow: FLOW, type: 'RUNTIME', intact: true, sharedWith: ['REPLAY'] }),
      buildBoundary({ flow: FLOW, type: 'REPLAY', intact: true, sharedWith: ['RUNTIME'] }),
    ];
    const topology = analyzeIsolationTopology({ flow: FLOW, boundaries: bs });
    const propagation = analyzePropagationIsolation({ flow: FLOW, depth: 99, maxDepth: 5 });
    const env = buildIsolationEnvelope({ flow: FLOW, topology, leaks: [], propagation });
    expect(env.classification).toBe('COLLAPSED');
  });

  it('V. calculateIsolationScore penaliza overlaps e leaks', () => {
    const t = analyzeIsolationTopology({ flow: FLOW, boundaries: fullyIsolatedBoundaries() });
    const p = analyzePropagationIsolation({ flow: FLOW, depth: 1 });
    const baseline = calculateIsolationScore({ topology: t, leaks: [], propagation: p });
    const penalized = calculateIsolationScore({
      topology: t,
      leaks: [{ flow: FLOW, type: 'shared_boundary', severity: 'HIGH', boundaries: [], detail: '' }],
      propagation: p,
    });
    expect(penalized).toBeLessThan(baseline);
  });

  it('W. calculateIsolationSeverity = worst severity', () => {
    expect(calculateIsolationSeverity([])).toBe('NONE');
    expect(
      calculateIsolationSeverity([
        { flow: FLOW, type: 'shared_boundary', severity: 'LOW', boundaries: [], detail: '' },
        { flow: FLOW, type: 'topology_overlap', severity: 'HIGH', boundaries: [], detail: '' },
      ]),
    ).toBe('HIGH');
  });

  it('X. detectBoundaryLeak retorna null para intact sem sharing', () => {
    expect(detectBoundaryLeak(FLOW, buildBoundary({ flow: FLOW, type: 'RUNTIME', intact: true }))).toBeNull();
    expect(
      detectBoundaryLeak(FLOW, buildBoundary({ flow: FLOW, type: 'RUNTIME', intact: false }))?.severity,
    ).toBe('HIGH');
  });

  it('Y. aggregateIsolation soma classificações', () => {
    const e1 = buildEnvelopeFully();
    const e2 = { ...buildEnvelopeFully(), flow: FLOW2 as FlowId, classification: 'LEAKING' as const, severity: 'HIGH' as const };
    const a = aggregateIsolation([e1, e2]);
    expect(a.flows).toBe(2);
    expect(a.fullyIsolated).toBe(1);
    expect(a.leaking).toBe(1);
    expect(a.worstSeverity).toBe('HIGH');
  });

  it('Z. summarizeIsolationHealth ok quando sem colapso', () => {
    const e = buildEnvelopeFully();
    expect(summarizeIsolationHealth([e]).ok).toBe(true);
  });

  it('AA. aggregateIsolationLeaks/BoundaryRisks/Ranking', () => {
    const leaks = [
      { flow: FLOW, type: 'shared_boundary' as const, severity: 'HIGH' as const, boundaries: [], detail: '' },
      { flow: FLOW, type: 'topology_overlap' as const, severity: 'LOW' as const, boundaries: [], detail: '' },
    ];
    expect(aggregateIsolationLeaks(leaks).bySeverity.HIGH).toBe(1);
    const risks = aggregateBoundaryRisks([
      buildBoundary({ flow: FLOW, type: 'RUNTIME', intact: false }),
      buildBoundary({ flow: FLOW, type: 'REPLAY', intact: true, sharedWith: ['RUNTIME'] }),
    ]);
    expect(risks.broken).toBe(1);
    expect(risks.shared).toBe(1);
    const ranking = buildIsolationRanking([
      buildEnvelopeFully(),
      { ...buildEnvelopeFully(), flow: FLOW2 as FlowId, severity: 'CRITICAL' as const, score: 0.1 },
    ]);
    expect(ranking[0].flow).toBe(FLOW2);
  });

  it('AB. buildIsolationCertification + classifyIsolationSafety + confidence', () => {
    const env = buildEnvelopeFully();
    const safety = classifyIsolationSafety(env);
    expect(safety.safe).toBe(true);
    const conf = calculateIsolationConfidence(env);
    expect(conf).toBeGreaterThanOrEqual(0.6);
    const cert = buildIsolationCertification(env);
    expect(cert.certified).toBe(true);
  });

  it('AC. rankIsolationCertification: certificados primeiro', () => {
    const certs = [
      buildIsolationCertification({ ...buildEnvelopeFully(), classification: 'COLLAPSED' as const, severity: 'CRITICAL' as const, score: 0 }),
      buildIsolationCertification(buildEnvelopeFully()),
    ];
    expect(rankIsolationCertification(certs)[0].certified).toBe(true);
  });

  it('AD. detectIsolationCertificationGap detecta certificação inconsistente', () => {
    const fake = {
      flow: FLOW, certified: true, confidence: 0.9,
      classification: 'FULLY_ISOLATED' as const, severity: 'CRITICAL' as const, reasons: [],
    };
    expect(detectIsolationCertificationGap([fake]).length).toBeGreaterThan(0);
  });

  it('AE. adapters inertes não mutam input', () => {
    const inputs = {
      flow: FLOW,
      recorder: { intact: true } as const,
      replay: { intact: false, sharedWith: ['CAUSALITY'] as const } as const,
    };
    const bs = adaptRuntimeLayersToBoundaries(inputs);
    expect(bs).toHaveLength(2);
    expect(bs.some((b) => b.type === 'RUNTIME')).toBe(true);
    expect(bs.some((b) => b.type === 'REPLAY' && !b.intact)).toBe(true);
  });

  it('AF. observability PII-free + sanitização', () => {
    const safe = buildIsolationAuditPayload('runtime_isolation_generated', FLOW, { score: 0.9, severity: 'NONE' });
    expect(isIsolationAuditPayloadPiiFree(safe)).toBe(true);
    const stripped = buildIsolationAuditPayload('runtime_isolation_generated', FLOW, {
      email: 'a@b.com', ip: '1.2.3.4', score: 0.5,
    });
    expect(Object.keys(stripped.metadata)).toEqual(['score']);
    const dirty = { action: 'runtime_isolation_generated' as const, flow: FLOW, metadata: { email: 'a@b.com' } };
    expect(isIsolationAuditPayloadPiiFree(dirty)).toBe(false);
    expect(ISOLATION_AUDIT_ACTIONS).toContain('runtime_isolation_collapsed');
  });

  it('AG. guards: coverage/containment/readonly/topology/certification/observability', () => {
    const env = buildEnvelopeFully();
    expect(assertIsolationCoverage([env], [FLOW, FLOW2])).toHaveLength(1);
    expect(assertIsolationReadOnlyInvariant(env)).toHaveLength(0);
    expect(assertIsolationContainment(env)).toHaveLength(0);
    expect(assertIsolationTopologyIntegrity(env)).toHaveLength(0);
    expect(assertIsolationCertificationIntegrity([buildIsolationCertification(env)])).toHaveLength(0);
    const payloads = [buildIsolationAuditPayload('runtime_isolation_generated', FLOW, { score: 0.9 })];
    expect(assertIsolationObservabilityPurity(payloads, ISOLATION_AUDIT_ACTIONS)).toHaveLength(0);
  });

  it('AH. assertNoIsolationLeakExpansion detecta expansão', () => {
    const prev = buildEnvelopeFully();
    const current: IsolationEnvelope = {
      ...prev,
      leaks: [{ flow: FLOW, type: 'shared_boundary', severity: 'LOW', boundaries: [], detail: '' }],
    };
    expect(assertNoIsolationLeakExpansion(prev, current)).toHaveLength(1);
  });

  it('AI. assertIsolationDeterminism', () => {
    const a = buildEnvelopeFully();
    const b = { ...buildEnvelopeFully(), score: 0.1, classification: 'LEAKING' as const };
    expect(assertIsolationDeterminism(a, b).length).toBeGreaterThan(0);
  });

  it('AJ. assertAllIsolationIntegrity agrega', () => {
    const env = buildEnvelopeFully();
    const v = assertAllIsolationIntegrity({
      envelopes: [env],
      expectedFlows: [FLOW],
      certifications: [buildIsolationCertification(env)],
      payloads: [buildIsolationAuditPayload('runtime_isolation_generated', FLOW, { score: 1 })],
      allowedActions: ISOLATION_AUDIT_ACTIONS,
    });
    expect(v).toHaveLength(0);
  });

  it('AK. invariantes read-only sempre presentes', () => {
    const e = buildEnvelopeFully();
    expect(e.liveExecutionEnabled).toBe(false);
    expect(e.retryEnabled).toBe(false);
    expect(e.backgroundEnabled).toBe(false);
    expect(e.realUsersAllowed).toBe(false);
    expect(e.currentStage).toBe('STAGE_0_READ_ONLY');
  });

  it('AL. explainers retornam strings determinísticas', () => {
    const e = buildEnvelopeFully();
    expect(explainIsolation(e)).toContain(FLOW);
    expect(explainIsolationLeak({ flow: FLOW, type: 'shared_boundary', severity: 'LOW', boundaries: [], detail: 'x' })).toContain('shared_boundary');
    expect(explainIsolationCertification(buildIsolationCertification(e))).toContain('CERTIFIED');
    expect(explainIsolationTopology(e.topology)).toContain('Topology');
    expect(explainIsolationAggregation(aggregateIsolation([e]))).toContain('flows=1');
  });
});
