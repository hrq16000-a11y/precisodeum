import { describe, it, expect } from 'vitest';
import {
  CORRELATION_POLICY,
  buildOperationalPropagationGraph,
  computeOperationalConsensus,
  correlateOperationalFindings,
  forecastOperationalImpact,
  type CorrelationFinding,
} from '@/lib/onboarding/operationalCorrelation';

const f = (overrides: Partial<CorrelationFinding> & { id: string; detector: string }): CorrelationFinding => ({
  severity: 'medium',
  confidence: 0.7,
  ...overrides,
});

describe('operationalCorrelation · policy', () => {
  it('é frozen e read-only', () => {
    expect(Object.isFrozen(CORRELATION_POLICY)).toBe(true);
    expect(CORRELATION_POLICY.allow_auto_mitigation).toBe(false);
    expect(CORRELATION_POLICY.allow_realtime).toBe(false);
    expect(CORRELATION_POLICY.allow_ai).toBe(false);
    expect(CORRELATION_POLICY.read_only).toBe(true);
  });
});

describe('operationalCorrelation · fail-soft', () => {
  it('aceita undefined', () => {
    const snap = correlateOperationalFindings(undefined);
    expect(snap.correlatedIncidents).toEqual([]);
    expect(snap.scores.systemic_stability).toBe(100);
    expect(snap.scores.operational_entropy).toBe(0);
  });

  it('aceita input vazio', () => {
    const snap = correlateOperationalFindings({});
    expect(snap.propagationGraph.nodes).toEqual([]);
    expect(snap.confidenceMatrix).toHaveLength(6);
  });

  it('descarta findings malformados', () => {
    const snap = correlateOperationalFindings({
      reality: [{ id: '', detector: 'x' } as any, null as any, undefined as any],
    });
    expect(snap.correlatedIncidents).toEqual([]);
  });

  it('é determinístico', () => {
    const input = {
      reality: [f({ id: 'r1', detector: 'partial_persistence', phase: 'p2', sessionId: 's1' })],
      memory: [f({ id: 'm1', detector: 'recovery', phase: 'p2', sessionId: 's1' })],
    };
    const a = correlateOperationalFindings(input);
    const b = correlateOperationalFindings(input);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('operationalCorrelation · detectores', () => {
  it('detecta cascading_persistence_failure', () => {
    const snap = correlateOperationalFindings({
      reality: [f({ id: 'r1', detector: 'partial_persistence', severity: 'high' })],
      hardening: [f({ id: 'h1', detector: 'incomplete_transaction', severity: 'high' })],
    });
    expect(snap.correlatedIncidents.some((i) => i.pattern === 'cascading_persistence_failure')).toBe(true);
  });

  it('detecta correlated_recovery_break', () => {
    const snap = correlateOperationalFindings({
      reality: [f({ id: 'r1', detector: 'recovery_integrity_failure' })],
      memory: [f({ id: 'm1', detector: 'broken_chain' })],
    });
    expect(snap.correlatedIncidents.some((i) => i.pattern === 'correlated_recovery_break')).toBe(true);
  });

  it('detecta systemic_navigation_instability', () => {
    const snap = correlateOperationalFindings({
      reality: [f({ id: 'r1', detector: 'dead_navigation' })],
      hardening: [f({ id: 'h1', detector: 'navigation' })],
    });
    expect(snap.correlatedIncidents.some((i) => i.pattern === 'systemic_navigation_instability')).toBe(true);
  });

  it('detecta fragmented_session_cluster', () => {
    const snap = correlateOperationalFindings({
      reality: [f({ id: 'r1', detector: 'session_fragmentation' })],
      memory: [f({ id: 'm1', detector: 'state_fragmentation' })],
    });
    expect(snap.correlatedIncidents.some((i) => i.pattern === 'fragmented_session_cluster')).toBe(true);
  });

  it('detecta governance_runtime_divergence', () => {
    const snap = correlateOperationalFindings({
      governance: [f({ id: 'g1', detector: 'flag_without_runtime' })],
      selfAudit: [f({ id: 'sa1', detector: 'governance_inconsistency', tags: ['divergence'] })],
    });
    expect(snap.correlatedIncidents.some((i) => i.pattern === 'governance_runtime_divergence')).toBe(true);
  });

  it('detecta telemetry_truth_mismatch', () => {
    const snap = correlateOperationalFindings({
      evidence: [f({ id: 'e1', detector: 'truth_mismatch' })],
      selfAudit: [f({ id: 'sa1', detector: 'telemetry_mismatch' })],
    });
    expect(snap.correlatedIncidents.some((i) => i.pattern === 'telemetry_truth_mismatch')).toBe(true);
  });

  it('detecta chronic_retry_amplification', () => {
    const snap = correlateOperationalFindings({
      hardening: [f({ id: 'h1', detector: 'retry_storm', severity: 'high' })],
      reality: [f({ id: 'r1', detector: 'retry_amplified', severity: 'high' })],
    });
    expect(snap.correlatedIncidents.some((i) => i.pattern === 'chronic_retry_amplification')).toBe(true);
  });

  it('detecta hidden_partial_persistence', () => {
    const snap = correlateOperationalFindings({
      reality: [
        f({ id: 'r1', detector: 'phantom_success' }),
        f({ id: 'r2', detector: 'silent_failure' }),
      ],
      memory: [f({ id: 'm1', detector: 'partial_persistence' })],
    });
    expect(snap.correlatedIncidents.some((i) => i.pattern === 'hidden_partial_persistence')).toBe(true);
  });

  it('detecta multi_engine_consensus_failure por contradição de severidade', () => {
    const snap = correlateOperationalFindings({
      reality: [f({ id: 'r1', detector: 'partial_persistence', sessionId: 's1', severity: 'critical' })],
      evidence: [f({ id: 'e1', detector: 'truth_mismatch', sessionId: 's1', severity: 'low' })],
    });
    expect(snap.correlatedIncidents.some((i) => i.pattern === 'multi_engine_consensus_failure')).toBe(true);
  });

  it('escala severidade para critical quando há finding critical', () => {
    const snap = correlateOperationalFindings({
      reality: [f({ id: 'r1', detector: 'partial_persistence', severity: 'critical' })],
      hardening: [f({ id: 'h1', detector: 'incomplete_transaction', severity: 'low' })],
    });
    const inc = snap.correlatedIncidents.find((i) => i.pattern === 'cascading_persistence_failure');
    expect(inc?.severity).toBe('critical');
  });
});

describe('operationalCorrelation · consensus', () => {
  it('agreement_score reflete engines envolvidas', () => {
    const c = computeOperationalConsensus({
      reality: [f({ id: 'r1', detector: 'partial_persistence' })],
      hardening: [f({ id: 'h1', detector: 'incomplete_transaction' })],
    });
    expect(c.agreement_score).toBeGreaterThan(0);
    expect(c.supporting_engines.length).toBeGreaterThanOrEqual(2);
    expect(c.pattern).not.toBeNull();
  });

  it('contradiction_score sobe quando engines discordam', () => {
    const c = computeOperationalConsensus({
      reality: [f({ id: 'r1', detector: 'partial_persistence', sessionId: 's1', severity: 'critical' })],
      evidence: [f({ id: 'e1', detector: 'truth_mismatch', sessionId: 's1', severity: 'low' })],
    });
    expect(c.contradiction_score).toBeGreaterThan(0);
  });

  it('input vazio devolve consenso zero', () => {
    const c = computeOperationalConsensus({});
    expect(c.agreement_score).toBe(0);
    expect(c.confidence).toBe(0);
    expect(c.pattern).toBeNull();
  });
});

describe('operationalCorrelation · graph & chains', () => {
  it('constrói grafo com nós de engine + release', () => {
    const g = buildOperationalPropagationGraph({
      reality: [f({ id: 'r1', detector: 'partial_persistence', release: 'v1', sessionId: 's1' })],
      memory: [f({ id: 'm1', detector: 'recovery', release: 'v1', sessionId: 's1' })],
    });
    expect(g.nodes.some((n) => n.kind === 'release')).toBe(true);
    expect(g.nodes.some((n) => n.kind === 'reality')).toBe(true);
    expect(g.edges.length).toBeGreaterThan(0);
  });

  it('identifica clusters isolados', () => {
    const g = buildOperationalPropagationGraph({
      reality: [f({ id: 'r1', detector: 'x', sessionId: 'sa' })],
      governance: [f({ id: 'g1', detector: 'y', sessionId: 'sb' })],
    });
    expect(g.isolatedClusters).toBeGreaterThanOrEqual(2);
  });

  it('produz hotspots quando há nó de grau alto', () => {
    const snap = correlateOperationalFindings({
      reality: [f({ id: 'r1', detector: 'x', sessionId: 's1' })],
      memory: [f({ id: 'm1', detector: 'y', sessionId: 's1' })],
      hardening: [f({ id: 'h1', detector: 'z', sessionId: 's1' })],
      evidence: [f({ id: 'e1', detector: 'w', sessionId: 's1' })],
    });
    expect(snap.propagationGraph.systemicHotspots.length).toBeGreaterThan(0);
  });

  it('chains derivam de incidentes', () => {
    const snap = correlateOperationalFindings({
      reality: [f({ id: 'r1', detector: 'partial_persistence', sessionId: 's1' })],
      hardening: [f({ id: 'h1', detector: 'incomplete_transaction', sessionId: 's1' })],
    });
    expect(snap.propagationChains.length).toBeGreaterThan(0);
    expect(snap.propagationChains[0].depth).toBeGreaterThanOrEqual(1);
  });
});

describe('operationalCorrelation · scores', () => {
  it('entropy spike escala com criticals e contradições', () => {
    const snap = correlateOperationalFindings({
      reality: [
        f({ id: 'r1', detector: 'cascading_loop', severity: 'critical', sessionId: 's1' }),
        f({ id: 'r2', detector: 'hidden_loop', severity: 'critical' }),
      ],
      hardening: [f({ id: 'h1', detector: 'incomplete_transaction', severity: 'critical', sessionId: 's1' })],
      evidence: [f({ id: 'e1', detector: 'truth_mismatch', severity: 'low', sessionId: 's1' })],
    });
    expect(snap.scores.operational_entropy).toBeGreaterThan(20);
    expect(snap.scores.systemic_stability).toBeLessThan(100);
  });

  it('runtime_cohesion alto quando engines convergem sem entropia', () => {
    const snap = correlateOperationalFindings({
      reality: [f({ id: 'r1', detector: 'ok' })],
      memory: [f({ id: 'm1', detector: 'ok' })],
      hardening: [f({ id: 'h1', detector: 'ok' })],
      evidence: [f({ id: 'e1', detector: 'ok' })],
    });
    expect(snap.scores.runtime_cohesion).toBeGreaterThanOrEqual(50);
  });

  it('correlation_confidence reflete avg de confiança', () => {
    const snap = correlateOperationalFindings({
      reality: [f({ id: 'r1', detector: 'partial_persistence', confidence: 0.9 })],
      memory: [f({ id: 'm1', detector: 'recovery', confidence: 0.9 })],
    });
    expect(snap.scores.correlation_confidence).toBeGreaterThan(0);
  });
});

describe('operationalCorrelation · confidence matrix', () => {
  it('cobre as 6 engines mesmo sem findings', () => {
    const snap = correlateOperationalFindings({});
    expect(snap.confidenceMatrix.map((r) => r.engine).sort()).toEqual(
      ['evidence', 'governance', 'hardening', 'memory', 'reality', 'self_audit'],
    );
  });

  it('agreement_score sobe quando engine participa de incidente', () => {
    const snap = correlateOperationalFindings({
      reality: [f({ id: 'r1', detector: 'partial_persistence' })],
      hardening: [f({ id: 'h1', detector: 'incomplete_transaction' })],
    });
    const reality = snap.confidenceMatrix.find((r) => r.engine === 'reality')!;
    expect(reality.agreementScore).toBeGreaterThan(0);
  });
});

describe('operationalCorrelation · systemic patterns', () => {
  it('agrega ocorrências por padrão', () => {
    const snap = correlateOperationalFindings({
      reality: [
        f({ id: 'r1', detector: 'partial_persistence', sessionId: 's1' }),
        f({ id: 'r2', detector: 'partial_persistence', sessionId: 's2' }),
      ],
      hardening: [
        f({ id: 'h1', detector: 'incomplete_transaction', sessionId: 's1' }),
        f({ id: 'h2', detector: 'incomplete_transaction', sessionId: 's2' }),
      ],
    });
    const p = snap.systemicPatterns.find((sp) => sp.pattern === 'cascading_persistence_failure');
    expect(p).toBeDefined();
    expect(p!.occurrences).toBeGreaterThanOrEqual(1);
  });
});

describe('operationalCorrelation · forecastOperationalImpact', () => {
  it('estima risco maior quando severity é high', () => {
    const r = forecastOperationalImpact({ affectedAreas: ['persistence', 'recovery'], severity: 'high' });
    expect(['high', 'critical']).toContain(r.estimatedRisk);
    expect(r.likelyRegressions.length).toBeGreaterThan(0);
  });

  it('propagationProbability cresce com blast radius', () => {
    const a = forecastOperationalImpact({ affectedAreas: ['telemetry'], severity: 'low', blastRadius: 0 });
    const b = forecastOperationalImpact({ affectedAreas: ['telemetry'], severity: 'low', blastRadius: 10 });
    expect(b.propagationProbability).toBeGreaterThanOrEqual(a.propagationProbability);
  });

  it('aceita áreas desconhecidas sem quebrar', () => {
    const r = forecastOperationalImpact({ affectedAreas: ['xyz'], severity: 'low' });
    expect(r.likelyRegressions).toEqual([]);
    expect(r.confidence).toBeGreaterThan(0);
  });

  it('é determinístico', () => {
    const input = { affectedAreas: ['persistence', 'navigation'], severity: 'medium' as const, blastRadius: 3 };
    expect(JSON.stringify(forecastOperationalImpact(input))).toBe(
      JSON.stringify(forecastOperationalImpact(input)),
    );
  });
});
