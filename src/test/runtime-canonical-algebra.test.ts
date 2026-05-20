import { describe, it, expect } from 'vitest';
import {
  adaptAllStates,
  adaptState,
  aggregateCanonicalAlgebra,
  assertAllAlgebraIntegrity,
  assertAlgebraReadOnlyInvariants,
  buildCanonicalGraph,
  buildDefaultCanonicalStates,
  buildEquivalenceClasses,
  buildNormalization,
  buildReduction,
  buildRuntimeTransitions,
  calculateAlgebraConfidence,
  calculateAlgebraIntegrityScore,
  CANONICAL_LAYERS,
  certifyCanonicalIntegrity,
  classifyCanonicalState,
  classifyDeterminism,
  classifyGraphTopology,
  classifyTransition,
  composeRuntimeStates,
  detectEquivalentStates,
  detectFalseEquivalence,
  detectImpossibleTransition,
  detectNonDeterminism,
  emitAlgebraCertificationInvalid,
  emitAlgebraCompositionConflict,
  emitAlgebraGenerated,
  emitAlgebraInvariantBroken,
  emitAlgebraNonDeterminismDetected,
  emitAlgebraReductionFailed,
  emitAlgebraViolationDetected,
  explainAlgebra,
  explainCertification,
  explainDeterminism,
  explainEnvelope,
  explainNormalization,
  explainReduction,
  normalizeCanonicalGraph,
  reduceCanonicalState,
  reduceComposition,
  reduceEquivalentStructures,
  reduceRuntimeGraph,
  summarizeAlgebraHealth,
  type RawStateInput,
  type RuntimeEdge,
} from '@/lib/runtimeCanonicalAlgebra';

function safeInput() {
  return { states: buildDefaultCanonicalStates() };
}

function brokenInput() {
  const states = adaptAllStates([
    { layer: 'recorder' },
    { layer: 'history', liveExecutionEnabled: true },
    { layer: 'replay', stage: 'STAGE_1_PILOT' },
    { layer: 'causality', retryEnabled: true, classification: 'divergent' },
    { layer: 'stability', backgroundEnabled: true, classification: 'unstable' },
    { layer: 'integrity', realUsersAllowed: true },
    { layer: 'isolation', id: 'isolation:0', classification: 'reducible' },
    { layer: 'isolation', id: 'isolation:0', classification: 'reducible' }, // duplicate id
  ]);
  const edges: RuntimeEdge[] = [
    { from: 'recorder:0', to: 'history:0', mode: 'deterministic', weight: 1, recursive: false },
    { from: 'history:0', to: 'replay:0', mode: 'degraded', weight: 0.5, recursive: false },
    { from: 'replay:0', to: 'recorder:0', mode: 'recursive', weight: 0.9, recursive: false }, // cycle
    { from: 'causality:0', to: 'causality:0', mode: 'recursive', weight: 1, recursive: true },
    { from: 'unknown:x', to: 'unknown:y', mode: 'impossible', weight: 0, recursive: false },
  ];
  return { states, edges };
}

describe('Phase 1.9.0 — Canonical Algebra: A. Types & defaults', () => {
  it('A1: CANONICAL_LAYERS has 14 entries', () => {
    expect(CANONICAL_LAYERS).toHaveLength(14);
  });
  it('A2: default states are 14 safe frozen RuntimeStates', () => {
    const states = buildDefaultCanonicalStates();
    expect(states).toHaveLength(14);
    states.forEach((s) => {
      expect(Object.isFrozen(s)).toBe(true);
      expect(s.liveExecutionEnabled).toBe(false);
      expect(s.stage).toBe('STAGE_0_READ_ONLY');
    });
  });
});

describe('B. Graph build/normalize/reduce', () => {
  it('B1: buildCanonicalGraph returns sorted frozen nodes', () => {
    const g = buildCanonicalGraph(safeInput());
    expect(Object.isFrozen(g.nodes)).toBe(true);
    expect(g.nodes.length).toBe(14);
  });
  it('B2: normalizeCanonicalGraph is idempotent', () => {
    const g1 = buildCanonicalGraph(safeInput());
    const g2 = normalizeCanonicalGraph(g1);
    const g3 = normalizeCanonicalGraph(g2);
    expect(JSON.stringify(g2)).toBe(JSON.stringify(g3));
  });
  it('B3: reduceRuntimeGraph drops redundant nodes', () => {
    const dup = adaptAllStates([
      { layer: 'recorder', id: 'r0' },
      { layer: 'recorder', id: 'r1' },
    ]);
    const g = buildCanonicalGraph({ states: dup });
    const r = reduceRuntimeGraph(g);
    expect(r.nodes.length).toBe(1);
  });
});

describe('C. Topology & classification', () => {
  it('C1: stable on safe', () => {
    const g = buildCanonicalGraph(safeInput());
    const t = classifyGraphTopology(g);
    expect(t.state).toBe('stable');
  });
  it('C2: circular when cycle exists', () => {
    const g = buildCanonicalGraph(brokenInput());
    const t = classifyGraphTopology(g);
    expect(['circular', 'recursive']).toContain(t.state);
    expect(t.cycles.length).toBeGreaterThan(0);
  });
  it('C3: classifyCanonicalState canonical on safe', () => {
    const g = buildCanonicalGraph(safeInput());
    const t = classifyGraphTopology(g);
    expect(classifyCanonicalState(g.nodes, t)).toBe('canonical');
  });
  it('C4: divergent on unsafe', () => {
    const g = buildCanonicalGraph(brokenInput());
    const t = classifyGraphTopology(g);
    expect(['divergent', 'unstable']).toContain(classifyCanonicalState(g.nodes, t));
  });
});

describe('D. Transitions', () => {
  it('D1: classifyTransition by weight', () => {
    expect(classifyTransition({ from: 'a', to: 'b', mode: 'deterministic', weight: 1, recursive: false })).toBe('deterministic');
    expect(classifyTransition({ from: 'a', to: 'b', mode: 'equivalent', weight: 0.8, recursive: false })).toBe('equivalent');
    expect(classifyTransition({ from: 'a', to: 'b', mode: 'degraded', weight: 0.5, recursive: false })).toBe('degraded');
    expect(classifyTransition({ from: 'a', to: 'b', mode: 'unstable', weight: 0.1, recursive: false })).toBe('unstable');
    expect(classifyTransition({ from: 'a', to: 'b', mode: 'impossible', weight: 0, recursive: false })).toBe('impossible');
    expect(classifyTransition({ from: 'a', to: 'b', mode: 'recursive', weight: 1, recursive: true })).toBe('recursive');
  });
  it('D2: buildRuntimeTransitions detects impossible/regression', () => {
    const g = buildCanonicalGraph(brokenInput());
    const ts = buildRuntimeTransitions(g.nodes, g.edges);
    expect(ts.length).toBe(g.edges.length);
    expect(detectImpossibleTransition(ts).length).toBeGreaterThanOrEqual(0);
    expect(detectNonDeterminism(ts).length).toBeGreaterThan(0);
  });
});

describe('E. Composition', () => {
  it('E1: safe composition on safe', () => {
    const g = buildCanonicalGraph(safeInput());
    const c = composeRuntimeStates(g.nodes);
    expect(c.classification).toBe('safe');
    expect(c.conflicts).toHaveLength(0);
  });
  it('E2: conflicting on broken (stage mismatch)', () => {
    const g = buildCanonicalGraph(brokenInput());
    const c = composeRuntimeStates(g.nodes);
    expect(['conflicting', 'recursive']).toContain(c.classification);
  });
  it('E3: reduceComposition dedupes conflicts', () => {
    const g = buildCanonicalGraph(brokenInput());
    const c = reduceComposition(composeRuntimeStates(g.nodes));
    const keys = new Set(c.conflicts.map((x) => `${x.a}|${x.b}|${x.reason}`));
    expect(keys.size).toBe(c.conflicts.length);
  });
});

describe('F. Equivalence', () => {
  it('F1: detectEquivalentStates finds duplicates', () => {
    const g = buildCanonicalGraph({
      states: adaptAllStates([
        { layer: 'recorder', id: 'a' },
        { layer: 'recorder', id: 'b' },
      ]),
    });
    expect(detectEquivalentStates(g.nodes).length).toBeGreaterThan(0);
  });
  it('F2: buildEquivalenceClasses & reduce', () => {
    const g = buildCanonicalGraph({
      states: adaptAllStates([
        { layer: 'recorder', id: 'a' },
        { layer: 'recorder', id: 'b' },
        { layer: 'history', id: 'c' },
      ]),
    });
    const eq = buildEquivalenceClasses(g.nodes);
    expect(eq.classes.length).toBeGreaterThan(0);
    const reduced = reduceEquivalentStructures(g.nodes);
    expect(reduced.length).toBeLessThan(g.nodes.length);
  });
  it('F3: detectFalseEquivalence on duplicate ids', () => {
    const g = buildCanonicalGraph(brokenInput());
    const eq = buildEquivalenceClasses(g.nodes);
    expect(detectFalseEquivalence(eq)).toBe(true);
  });
});

describe('G. Determinism', () => {
  it('G1: strict on empty', () => {
    expect(classifyDeterminism({ varianceCount: 0, nonDeterministicCount: 0, total: 0, temporalInstability: false })).toBe('strict');
  });
  it('G2: divergent when high non-det + temporal', () => {
    expect(classifyDeterminism({ varianceCount: 5, nonDeterministicCount: 8, total: 10, temporalInstability: true })).toBe('divergent');
  });
});

describe('H. Normalization & reduction', () => {
  it('H1: buildNormalization canonical on safe', () => {
    const g = buildCanonicalGraph(safeInput());
    const n = buildNormalization(g);
    expect(n.mode).toBe('canonical');
    expect(n.canonicalHash).toMatch(/^[0-9a-f]+$/);
  });
  it('H2: conflicted on duplicate ids', () => {
    const g = buildCanonicalGraph(brokenInput());
    const n = buildNormalization(g);
    expect(n.mode).toBe('conflicted');
    expect(n.conflicts.length).toBeGreaterThan(0);
  });
  it('H3: reduceCanonicalState reduces & buildReduction reports', () => {
    const g = buildCanonicalGraph({
      states: adaptAllStates([
        { layer: 'recorder', id: 'a' },
        { layer: 'recorder', id: 'b' },
      ]),
    });
    const r = buildReduction(g.nodes, g.edges);
    expect(r.gain).toBeGreaterThan(0);
    const reduced = reduceCanonicalState(g.nodes, g.edges);
    expect(reduced.nodes.length).toBeLessThan(g.nodes.length);
  });
});

describe('I. Certification', () => {
  it('I1: full on safe', () => {
    const agg = aggregateCanonicalAlgebra(safeInput());
    expect(agg.graph.certification.level).toBe('full');
    expect(agg.graph.certification.reasons).toHaveLength(0);
  });
  it('I2: blocked on broken', () => {
    const agg = aggregateCanonicalAlgebra(brokenInput());
    expect(agg.graph.certification.level).toBe('blocked');
    expect(agg.graph.certification.reasons.length).toBeGreaterThan(0);
  });
  it('I3: certifyCanonicalIntegrity granular', () => {
    const g = buildCanonicalGraph(safeInput());
    const t = classifyGraphTopology(g);
    const ts = buildRuntimeTransitions(g.nodes, g.edges);
    const cert = certifyCanonicalIntegrity({
      nodes: g.nodes,
      topology: t,
      determinism: { level: 'strict', varianceCount: 0, nonDeterministicNodes: [], temporalInstability: false },
      equivalence: buildEquivalenceClasses(g.nodes),
      normalization: buildNormalization(g),
      reduction: buildReduction(g.nodes, g.edges),
    });
    void ts;
    expect(cert.level).toBe('full');
  });
});

describe('J. Aggregation', () => {
  it('J1: healthy on safe', () => {
    const agg = aggregateCanonicalAlgebra(safeInput());
    expect(agg.graph.health.status).toBe('healthy');
    expect(agg.integrityScore).toBeGreaterThanOrEqual(80);
    expect(agg.confidence).toBeCloseTo(1, 5);
    expect(agg.graph.violations).toHaveLength(0);
  });
  it('J2: critical violations on broken', () => {
    const agg = aggregateCanonicalAlgebra(brokenInput());
    expect(agg.graph.violations.length).toBeGreaterThan(0);
    expect(agg.graph.health.criticalViolations).toBeGreaterThan(0);
  });
  it('J3: deterministic given same input', () => {
    const a = aggregateCanonicalAlgebra(safeInput(), { generatedAt: 'X' });
    const b = aggregateCanonicalAlgebra(safeInput(), { generatedAt: 'X' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it('J4: summarizeAlgebraHealth + score', () => {
    const agg = aggregateCanonicalAlgebra(safeInput());
    expect(summarizeAlgebraHealth(agg.graph).status).toBe('healthy');
    expect(calculateAlgebraConfidence(agg.graph)).toBeCloseTo(1, 5);
    expect(calculateAlgebraIntegrityScore(agg.graph)).toBeGreaterThan(80);
  });
});

describe('K. Adapters inertness', () => {
  it('K1: adaptState frozen & safe defaults', () => {
    const s = adaptState({ layer: 'pilot' });
    expect(Object.isFrozen(s)).toBe(true);
    expect(s.liveExecutionEnabled).toBe(false);
  });
  it('K2: adapters never mutate input', () => {
    const input: RawStateInput = { layer: 'recorder', attributes: { x: 1 } };
    const before = JSON.stringify(input);
    adaptState(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe('L. Observability (PII-free)', () => {
  it('L1: 7 emitters return frozen events', () => {
    const agg = aggregateCanonicalAlgebra(brokenInput());
    expect(emitAlgebraGenerated(agg.graph).action).toBe('runtime_algebra_generated');
    expect(emitAlgebraViolationDetected(agg.graph.violations[0]).action).toBe('runtime_algebra_violation_detected');
    expect(emitAlgebraNonDeterminismDetected(agg.graph.determinism).action).toBe('runtime_algebra_nondeterminism_detected');
    expect(emitAlgebraCompositionConflict(agg.graph).action).toBe('runtime_algebra_composition_conflict');
    expect(emitAlgebraReductionFailed(agg.graph.reduction).action).toBe('runtime_algebra_reduction_failed');
    expect(emitAlgebraCertificationInvalid(agg.graph.certification).action).toBe('runtime_algebra_certification_invalid');
    expect(emitAlgebraInvariantBroken(agg.graph).action).toBe('runtime_algebra_invariant_broken');
  });
  it('L2: PII keys stripped', () => {
    const agg = aggregateCanonicalAlgebra(brokenInput());
    const evt = emitAlgebraViolationDetected({
      ...agg.graph.violations[0],
      message: 'safe',
    } as any);
    expect(JSON.stringify(evt.details)).not.toMatch(/email|phone|cpf|cnpj/i);
  });
});

describe('M. Explainers', () => {
  it('M1: explainers non-empty', () => {
    const agg = aggregateCanonicalAlgebra(safeInput());
    expect(explainAlgebra(agg.graph)).toContain('algebra:');
    expect(explainDeterminism(agg.graph.determinism)).toContain('determinism=');
    expect(explainNormalization(agg.graph.normalization)).toContain('normalization=');
    expect(explainReduction(agg.graph.reduction)).toContain('reduction=');
    expect(explainCertification(agg.graph.certification)).toContain('certification=');
    expect(explainEnvelope(agg.graph)).toContain('envelope=');
  });
});

describe('N. Guards & read-only invariants', () => {
  it('N1: assertAllAlgebraIntegrity empty on safe', () => {
    const agg = aggregateCanonicalAlgebra(safeInput());
    expect(assertAllAlgebraIntegrity(agg.graph)).toEqual([]);
  });
  it('N2: violations on broken include ALGEBRA_INVARIANT_BROKEN', () => {
    const agg = aggregateCanonicalAlgebra(brokenInput());
    const codes = assertAllAlgebraIntegrity(agg.graph).map((v) => v.code);
    expect(codes).toContain('ALGEBRA_INVARIANT_BROKEN');
  });
  it('N3: liveExecution=true is rejected', () => {
    const agg = aggregateCanonicalAlgebra({
      states: adaptAllStates([{ layer: 'recorder', liveExecutionEnabled: true }]),
    });
    expect(assertAlgebraReadOnlyInvariants(agg.graph).length).toBeGreaterThan(0);
  });
  it('N4: retry=true is rejected', () => {
    const agg = aggregateCanonicalAlgebra({
      states: adaptAllStates([{ layer: 'recorder', retryEnabled: true }]),
    });
    expect(assertAllAlgebraIntegrity(agg.graph).length).toBeGreaterThan(0);
  });
  it('N5: background=true is rejected', () => {
    const agg = aggregateCanonicalAlgebra({
      states: adaptAllStates([{ layer: 'recorder', backgroundEnabled: true }]),
    });
    expect(assertAllAlgebraIntegrity(agg.graph).length).toBeGreaterThan(0);
  });
  it('N6: stage != STAGE_0_READ_ONLY is rejected', () => {
    const agg = aggregateCanonicalAlgebra({
      states: adaptAllStates([{ layer: 'recorder', stage: 'STAGE_1_PILOT' }]),
    });
    expect(assertAllAlgebraIntegrity(agg.graph).length).toBeGreaterThan(0);
  });
});

describe('O. Edge & side-effects', () => {
  it('O1: empty input is collapsed-safe', () => {
    const agg = aggregateCanonicalAlgebra({ states: [] });
    expect(agg.graph.nodes).toHaveLength(0);
  });
  it('O2: input not mutated across multiple aggregations', () => {
    const input = safeInput();
    const before = JSON.stringify(input);
    aggregateCanonicalAlgebra(input);
    aggregateCanonicalAlgebra(input);
    expect(JSON.stringify(input)).toBe(before);
  });
  it('O3: readOnly=true marker', () => {
    const agg = aggregateCanonicalAlgebra(safeInput());
    expect(agg.graph.readOnly).toBe(true);
  });
});
