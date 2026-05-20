import {
  buildCanonicalGraph,
  classifyCanonicalState,
  classifyGraphTopology,
  reduceRuntimeGraph,
} from './canonicalGraph';
import { buildRuntimeTransitions } from './runtimeTransitions';
import { composeRuntimeStates, reduceComposition } from './runtimeComposition';
import { buildEquivalenceClasses } from './runtimeEquivalence';
import { aggregateDeterminismHealth } from './runtimeDeterminism';
import { buildNormalization, normalizeCanonicalGraph } from './runtimeNormalization';
import { buildReduction } from './runtimeReduction';
import { certifyCanonicalIntegrity } from './runtimeCertification';
import type {
  CanonicalRuntimeGraph,
  RuntimeAlgebraAggregation,
  RuntimeAlgebraHealth,
  RuntimeAlgebraRisk,
  RuntimeAlgebraSeverity,
  RuntimeAlgebraViolation,
  RuntimeCanonicalEnvelope,
  RuntimeCanonicalInvariant,
  RuntimeEdge,
  RuntimeState,
} from './algebraTypes';

const SEV_W: Record<RuntimeAlgebraSeverity, number> = {
  info: 0,
  low: 1,
  medium: 3,
  high: 6,
  critical: 10,
};

function buildEnvelope(nodes: readonly { state: RuntimeState; id: string }[]): RuntimeCanonicalEnvelope {
  const checks: ReadonlyArray<{
    name: string;
    pass: (s: RuntimeState) => boolean;
  }> = [
    { name: 'liveExecutionDisabled', pass: (s) => !s.liveExecutionEnabled },
    { name: 'retryDisabled', pass: (s) => !s.retryEnabled },
    { name: 'backgroundDisabled', pass: (s) => !s.backgroundEnabled },
    { name: 'realUsersDisallowed', pass: (s) => !s.realUsersAllowed },
    { name: 'readOnlyStage', pass: (s) => s.stage === 'STAGE_0_READ_ONLY' },
  ];
  const invariants: RuntimeCanonicalInvariant[] = checks.map((c) => {
    const violators = nodes.filter((n) => !c.pass(n.state)).map((n) => n.id);
    return Object.freeze({ name: c.name, satisfied: violators.length === 0, violators });
  });
  const allViolators = Array.from(new Set(invariants.flatMap((i) => i.violators)));
  const sealed = invariants.every((i) => i.satisfied);
  return Object.freeze({
    sealed,
    invariants: Object.freeze(invariants),
    violators: Object.freeze(allViolators),
  });
}

export function rankRisks(risks: readonly RuntimeAlgebraRisk[]): readonly RuntimeAlgebraRisk[] {
  return Object.freeze([...risks].sort((a, b) => SEV_W[b.severity] - SEV_W[a.severity]));
}

export function rankViolations(
  v: readonly RuntimeAlgebraViolation[],
): readonly RuntimeAlgebraViolation[] {
  return Object.freeze([...v].sort((a, b) => SEV_W[b.severity] - SEV_W[a.severity]));
}

export function calculateAlgebraConfidence(g: CanonicalRuntimeGraph): number {
  const c = g.certification.confidence;
  const det = g.determinism.level === 'strict' ? 1 : g.determinism.level === 'stable' ? 0.8 : 0.3;
  const env = g.envelope.sealed ? 1 : 0;
  return Math.max(0, Math.min(1, (c + det + env) / 3));
}

export function calculateAlgebraIntegrityScore(g: CanonicalRuntimeGraph): number {
  const base = calculateAlgebraConfidence(g) * 100;
  const penalty = g.violations.reduce((acc, v) => acc + SEV_W[v.severity], 0);
  return Math.max(0, Math.min(100, Math.round(base - penalty)));
}

export function summarizeAlgebraHealth(g: CanonicalRuntimeGraph): RuntimeAlgebraHealth {
  const score = calculateAlgebraIntegrityScore(g);
  const violationCount = g.violations.length;
  const criticalViolations = g.violations.filter((v) => v.severity === 'critical').length;
  let status: RuntimeAlgebraHealth['status'];
  if (criticalViolations > 0 || score < 25) status = 'collapsed';
  else if (score < 50) status = 'unstable';
  else if (score < 80) status = 'degraded';
  else status = 'healthy';
  return Object.freeze({ score, status, violationCount, criticalViolations });
}

export function aggregateCanonicalAlgebra(
  input: { readonly states: readonly RuntimeState[]; readonly edges?: readonly RuntimeEdge[] },
  options?: { generatedAt?: string },
): RuntimeAlgebraAggregation {
  // Build & normalize.
  const raw = buildCanonicalGraph(input);
  const { nodes, edges } = normalizeCanonicalGraph(raw);

  const topology = classifyGraphTopology({ nodes, edges });
  const transitions = buildRuntimeTransitions(nodes, edges);
  const composition = reduceComposition(composeRuntimeStates(nodes));
  const equivalence = buildEquivalenceClasses(nodes);
  const determinism = aggregateDeterminismHealth(nodes, transitions);
  const normalization = buildNormalization({ nodes, edges });

  const reducedGraph = reduceRuntimeGraph({ nodes, edges });
  const reduction = buildReduction(nodes, edges);
  void reducedGraph;

  const envelope = buildEnvelope(nodes);
  const classification = {
    stateClass: classifyCanonicalState(nodes, topology),
    topology: topology.state,
    determinism: determinism.level,
  } as const;
  const certification = certifyCanonicalIntegrity({
    nodes,
    topology,
    determinism,
    equivalence,
    normalization,
    reduction,
  });

  const violations: RuntimeAlgebraViolation[] = [];

  if (!envelope.sealed) {
    violations.push({
      code: 'ALGEBRA_INVARIANT_BROKEN',
      severity: 'critical',
      nodes: envelope.violators,
      message: 'Canonical envelope invariants violated',
    });
  }
  if (determinism.level === 'divergent' || determinism.level === 'unstable') {
    violations.push({
      code: 'ALGEBRA_NONDETERMINISTIC',
      severity: determinism.level === 'divergent' ? 'critical' : 'high',
      nodes: [...determinism.nonDeterministicNodes],
      message: `Determinism=${determinism.level}`,
    });
  }
  if (composition.classification === 'conflicting' || composition.classification === 'recursive') {
    violations.push({
      code: 'ALGEBRA_COMPOSITION_CONFLICT',
      severity: composition.classification === 'recursive' ? 'critical' : 'high',
      nodes: composition.conflicts.flatMap((c) => [c.a, c.b]),
      message: `Composition=${composition.classification}`,
    });
  }
  if (reduction.mode === 'unstable' || reduction.mode === 'recursive') {
    violations.push({
      code: 'ALGEBRA_REDUCTION_FAILED',
      severity: 'high',
      nodes: [],
      message: `Reduction mode=${reduction.mode}`,
    });
  }
  if (equivalence.falseEquivalences.length > 0) {
    violations.push({
      code: 'ALGEBRA_EQUIVALENCE_INVALID',
      severity: 'high',
      nodes: equivalence.falseEquivalences.flatMap((p) => [p.a, p.b]),
      message: 'False equivalence detected',
    });
  }
  if (topology.cycles.length > 0 || topology.recursive) {
    violations.push({
      code: 'ALGEBRA_TOPOLOGY_RECURSIVE',
      severity: topology.cycles.length > 0 ? 'critical' : 'high',
      nodes: topology.cycles[0] ?? [],
      message: `Topology=${topology.state}`,
    });
  }
  const impossible = transitions.filter((t) => !t.possible || t.mode === 'impossible');
  if (impossible.length > 0) {
    violations.push({
      code: 'ALGEBRA_TRANSITION_IMPOSSIBLE',
      severity: 'medium',
      nodes: impossible.flatMap((t) => [t.from, t.to]),
      message: `Impossible transitions=${impossible.length}`,
    });
  }
  if (normalization.mode === 'failed' || normalization.mode === 'conflicted') {
    violations.push({
      code: 'ALGEBRA_NORMALIZATION_FAILED',
      severity: 'high',
      nodes: [...normalization.conflicts],
      message: `Normalization=${normalization.mode}`,
    });
  }
  if (certification.level === 'blocked') {
    violations.push({
      code: 'ALGEBRA_CERTIFICATION_INVALID',
      severity: 'critical',
      nodes: nodes.map((n) => n.id),
      message: `Certification blocked: ${certification.reasons.join(',')}`,
    });
  }

  const risks: RuntimeAlgebraRisk[] = violations.map((v, i) =>
    Object.freeze({
      id: `risk_${i}_${v.code}`,
      severity: v.severity,
      description: v.message,
      nodes: v.nodes,
    }),
  );

  const partial: CanonicalRuntimeGraph = Object.freeze({
    generatedAt: options?.generatedAt ?? '1970-01-01T00:00:00.000Z',
    nodes,
    edges,
    states: Object.freeze(nodes.map((n) => n.state)),
    transitions,
    composition,
    equivalence,
    determinism,
    reduction,
    normalization,
    classification,
    topology,
    envelope,
    certification,
    violations: rankViolations(violations),
    risks: rankRisks(risks),
    health: Object.freeze({
      score: 0,
      status: 'healthy',
      violationCount: violations.length,
      criticalViolations: violations.filter((v) => v.severity === 'critical').length,
    }),
    readOnly: true,
  });

  const health = summarizeAlgebraHealth(partial);
  const final: CanonicalRuntimeGraph = Object.freeze({ ...partial, health });
  const confidence = calculateAlgebraConfidence(final);
  const integrityScore = calculateAlgebraIntegrityScore(final);

  return Object.freeze({
    graph: final,
    integrityScore,
    confidence,
    summary: `algebra=${final.health.status} cert=${final.certification.level} det=${final.determinism.level} class=${final.classification.stateClass} score=${integrityScore}`,
  });
}
