/**
 * Fase 1.8.2 — Replay builder (READ-ONLY).
 *
 * Reconstrução determinística sobre traces já observados. Sem I/O, sem
 * side-effects, sem persistência. Cada chamada devolve estruturas
 * imutáveis derivadas exclusivamente dos inputs.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import { OPERATION_REGISTRY } from '@/lib/operations/operationRegistry';
import type { RuntimeWriteTrace } from '@/lib/runtimeRecorder/recorderTypes';
import { calculateRuntimeParityGap } from '@/lib/runtimeRecorder/runtimeComparison';
import { simulateFlow } from '@/lib/atomicSimulation/simulateAtomicExecution';
import type {
  ReplayClassification,
  ReplayConfidence,
  ReplayConsistency,
  ReplayDeterminism,
  ReplayDriftReconstruction,
  ReplayFailurePropagation,
  ReplayLineage,
  ReplayLineageClass,
  ReplayParity,
  ReplayPropagation,
  ReplayRisk,
  ReplaySeverity,
  ReplayStep,
  ReplayWindow,
  RuntimeReplay,
} from './replayTypes';
import { buildReplayTopology } from './replayTopology';

const SEV_RANK: Record<ReplaySeverity, number> = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

function flowTracesOf(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): RuntimeWriteTrace[] {
  return traces.filter((t) => t.flow === flow);
}

function buildSteps(traces: readonly RuntimeWriteTrace[]): ReplayStep[] {
  const out: ReplayStep[] = [];
  let counter = 0;
  for (const t of traces) {
    for (const s of t.steps) {
      out.push({
        step: s.step,
        order: counter++,
        mirror: s.mirror,
        status:
          s.status === 'ok' || s.status === 'failed' || s.status === 'aborted' || s.status === 'skipped'
            ? s.status
            : 'skipped',
        logicalTimestamp: counter,
      });
    }
  }
  return out;
}

export function buildFlowReplay(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): RuntimeReplay {
  const flowTraces = flowTracesOf(flow, traces);
  const steps = buildSteps(flowTraces);
  const window: ReplayWindow = {
    flow,
    traceIds: flowTraces.map((t) => t.id),
    steps,
    firstSequence: steps[0]?.order ?? 0,
    lastSequence: steps[steps.length - 1]?.order ?? 0,
    samples: flowTraces.length,
  };

  const consistency = buildReplayConsistency(flow, flowTraces);
  const parity = buildReplayParity(flow, flowTraces);
  const propagation = reconstructFailurePropagation(flow, flowTraces);
  const drift = reconstructDriftEvolution(flow, flowTraces);
  const topology = buildReplayTopology(flow, flowTraces);
  const lineage = buildReplayLineage(flow, flowTraces);
  const determinism = classifyReplayDeterminism(flow, flowTraces, {
    consistency,
    parity,
    drift,
  });
  const classification = determinism.classification;
  const severity = worstSeverityFromTraces(flowTraces);
  const risk = classifyReplayRisk({
    classification,
    parity,
    propagation,
    drift,
    severity,
    lineage,
  });
  const confidence = determinism.confidence;

  return {
    flow,
    window,
    determinism,
    consistency,
    parity,
    propagation,
    drift,
    topology,
    lineage,
    classification,
    risk,
    severity,
    confidence,
    liveExecutionEnabled: false,
    realUsersAllowed: false,
    retryEnabled: false,
    backgroundEnabled: false,
    currentStage: 'STAGE_0_READ_ONLY',
  };
}

export function buildReplayMatrix(
  traces: readonly RuntimeWriteTrace[],
): RuntimeReplay[] {
  const flows = new Set<FlowId>(traces.map((t) => t.flow));
  return [...flows].map((f) => buildFlowReplay(f, traces));
}

/* ---------- Execution order ---------- */

export function reconstructExecutionOrder(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): readonly string[] {
  const flowTraces = flowTracesOf(flow, traces);
  // mode-of-orderings: pick the most common sequence; deterministic by first-seen tiebreak.
  const counts = new Map<string, { seq: string[]; count: number; firstIdx: number }>();
  flowTraces.forEach((t, idx) => {
    const key = t.ordering.actualOrder.join('>');
    const cur = counts.get(key);
    if (cur) cur.count++;
    else counts.set(key, { seq: [...t.ordering.actualOrder], count: 1, firstIdx: idx });
  });
  let best: { seq: string[]; count: number; firstIdx: number } | null = null;
  for (const v of counts.values()) {
    if (!best || v.count > best.count || (v.count === best.count && v.firstIdx < best.firstIdx)) {
      best = v;
    }
  }
  return best ? best.seq : [];
}

export function reconstructDependencyTimeline(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): ReadonlyArray<readonly [string, string]> {
  const edges = new Set<string>();
  for (const t of flowTracesOf(flow, traces)) {
    for (const s of t.steps) {
      for (const dep of s.dependsOn) {
        edges.add(`${dep}->${s.step}`);
      }
    }
  }
  return [...edges].map((e) => e.split('->') as [string, string]);
}

/* ---------- Failure propagation ---------- */

export function reconstructFailurePropagation(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): ReplayFailurePropagation {
  const flowTraces = flowTracesOf(flow, traces);
  const affected = new Set<string>();
  let cascadeDepth = 0;
  let cascading = false;
  let recursive = false;
  let circular = false;
  let isolated = true;

  for (const t of flowTraces) {
    const failed = t.steps.filter((s) => s.status === 'failed');
    if (failed.length > 0) isolated = false;
    if (t.orphanRisk || t.mirrorDependent) isolated = false;
    for (const f of failed) {
      affected.add(f.step);
      if (f.failure?.cascaded) {
        cascading = true;
        cascadeDepth = Math.max(cascadeDepth, t.steps.filter((s) => s.status === 'aborted' || s.status === 'skipped').length);
      }
    }
    if (t.orphanRisk) {
      cascading = true;
      for (const s of t.steps) if (s.mirror) affected.add(s.step);
    }
    // recursive: same step depends on itself (transitively in this trace)
    for (const s of t.steps) {
      if (s.dependsOn.includes(s.step)) recursive = true;
    }
  }

  // circular: dependency timeline has cycle
  const edges = reconstructDependencyTimeline(flow, flowTraces);
  if (hasCycle(edges)) circular = true;

  let propagation: ReplayPropagation = 'isolated';
  if (circular) propagation = 'circular';
  else if (recursive) propagation = 'recursive';
  else if (cascading) propagation = 'cascading';
  else if (!isolated) propagation = 'contained';

  return {
    flow,
    propagation,
    affectedSteps: [...affected],
    cascadeDepth,
  };
}

function hasCycle(edges: ReadonlyArray<readonly [string, string]>): boolean {
  const adj = new Map<string, string[]>();
  for (const [a, b] of edges) {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a)!.push(b);
  }
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const nodes = new Set<string>();
  for (const [a, b] of edges) {
    nodes.add(a); nodes.add(b);
  }
  function dfs(n: string): boolean {
    color.set(n, GRAY);
    for (const m of adj.get(n) ?? []) {
      const c = color.get(m) ?? WHITE;
      if (c === GRAY) return true;
      if (c === WHITE && dfs(m)) return true;
    }
    color.set(n, BLACK);
    return false;
  }
  for (const n of nodes) {
    if ((color.get(n) ?? WHITE) === WHITE && dfs(n)) return true;
  }
  return false;
}

/* ---------- Drift ---------- */

export function reconstructDriftEvolution(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): ReplayDriftReconstruction {
  const flowTraces = flowTracesOf(flow, traces);
  const total = flowTraces.length || 1;
  const orphan = flowTraces.filter((t) => t.orphanRisk).length;
  const mirror = flowTraces.filter((t) => t.mirrorDependent).length;
  const inconsistent = flowTraces.filter((t) => t.consistency === 'inconsistent').length;
  const finalizeGap = flowTraces.filter((t) =>
    t.steps.length > 0 && !t.steps.some((s) => (s.step === 'finalize' || s.step === 'finalize_sync') && s.status === 'ok'),
  ).length;

  let drift: ReplayDriftReconstruction['drift'] = 'none';
  if (orphan > 0) drift = 'orphaned';
  else if (inconsistent > 0) drift = 'ownership';
  else if (mirror > 0) drift = 'mirror_only';
  else if (finalizeGap > 0 && requiresFinalize(flow)) drift = 'finalize_gap';

  const emergence = Number(((orphan + mirror + inconsistent + (requiresFinalize(flow) ? finalizeGap : 0)) / (total * 4)).toFixed(3));

  let severity: ReplaySeverity = 'NONE';
  if (drift === 'orphaned') severity = 'CRITICAL';
  else if (drift === 'ownership') severity = 'HIGH';
  else if (drift === 'mirror_only') severity = 'MEDIUM';
  else if (drift === 'finalize_gap') severity = 'LOW';

  return { flow, drift, severity, emergenceScore: emergence };
}

function requiresFinalize(flow: FlowId): boolean {
  return OPERATION_REGISTRY.find((r) => r.flow === flow)?.requiresFinalize ?? false;
}

/* ---------- Consistency ---------- */

function buildReplayConsistency(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): ReplayConsistency {
  const total = traces.length || 1;
  let consistent = 0, orphan = 0, inconsistent = 0;
  for (const t of traces) {
    if (t.consistency === 'consistent') consistent++;
    if (t.consistency === 'orphaned') orphan++;
    if (t.consistency === 'inconsistent') inconsistent++;
  }
  const cRatio = consistent / total;
  const oRatio = orphan / total;
  const iRatio = inconsistent / total;
  return {
    flow,
    consistentRatio: Number(cRatio.toFixed(3)),
    orphanRatio: Number(oRatio.toFixed(3)),
    inconsistentRatio: Number(iRatio.toFixed(3)),
    stable: cRatio >= 0.95 && oRatio === 0 && iRatio < 0.05,
  };
}

/* ---------- Parity ---------- */

export function buildReplayParity(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): ReplayParity {
  const flowTraces = flowTracesOf(flow, traces);
  if (flowTraces.length === 0) {
    return {
      flow,
      score: 0,
      gap: 100,
      regression: true,
      rollbackMismatch: false,
      visibilityGap: false,
    };
  }
  const gaps = flowTraces.map((t) => calculateRuntimeParityGap(t).gap);
  const avgGap = gaps.reduce((s, n) => s + n, 0) / gaps.length;
  const score = Math.max(0, 100 - avgGap);
  const sim = simulateFlow(flow);
  const expectedOrder = sim ? sim.legacy.steps.map((s) => s.step) : [];
  const actualOrder = reconstructExecutionOrder(flow, flowTraces);
  const visibilityGap = expectedOrder.length > 0 && actualOrder.length !== expectedOrder.length;
  const rollbackMismatch = flowTraces.some((t) => t.mirrorDependent && t.classification === 'DIVERGENT');
  return {
    flow,
    score: Number(score.toFixed(2)),
    gap: Number(avgGap.toFixed(2)),
    regression: avgGap > 30,
    rollbackMismatch,
    visibilityGap,
  };
}

export function detectReplayParityGap(replay: RuntimeReplay): boolean {
  return replay.parity.gap > 15;
}

export function detectReplayOrderingRegression(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): boolean {
  const flowTraces = flowTracesOf(flow, traces);
  if (flowTraces.length < 2) return false;
  const sigs = new Set(flowTraces.map((t) => t.ordering.actualOrder.join('>')));
  // multiple distinct orderings → regression
  return sigs.size > 1;
}

/* ---------- Determinism ---------- */

export function classifyReplayDeterminism(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
  ctx?: {
    consistency?: ReplayConsistency;
    parity?: ReplayParity;
    drift?: ReplayDriftReconstruction;
  },
): ReplayDeterminism {
  const flowTraces = flowTracesOf(flow, traces);
  if (flowTraces.length === 0) {
    return {
      flow,
      classification: 'unreconstructable',
      orderingStable: false,
      outcomeStable: false,
      confidence: 'UNKNOWN',
      confidenceScore: 0,
    };
  }
  const cons = ctx?.consistency ?? buildReplayConsistency(flow, flowTraces);
  const par = ctx?.parity ?? buildReplayParity(flow, flowTraces);
  const drift = ctx?.drift ?? reconstructDriftEvolution(flow, flowTraces);

  const orderingStable = !detectReplayOrderingRegression(flow, flowTraces);
  const outcomeStable = cons.stable;

  const lineage = buildReplayLineage(flow, flowTraces);
  if (lineage.class === 'broken' || lineage.class === 'orphaned' || lineage.class === 'mirror_only') {
    return {
      flow,
      classification: 'unreconstructable',
      orderingStable,
      outcomeStable,
      confidence: 'LOW',
      confidenceScore: 0.1,
    };
  }

  let classification: ReplayClassification;
  if (drift.severity === 'CRITICAL' || par.regression || !orderingStable && !outcomeStable) {
    classification = 'divergent';
  } else if (!orderingStable) {
    classification = 'unstable';
  } else if (!outcomeStable || drift.drift === 'finalize_gap' || drift.drift === 'mirror_only') {
    classification = 'partially_deterministic';
  } else {
    classification = 'deterministic';
  }

  const score = calculateReplayConfidence({ cons, par, drift, orderingStable, samples: flowTraces.length });
  const confidence = scoreToConfidence(score);
  return {
    flow,
    classification,
    orderingStable,
    outcomeStable,
    confidence,
    confidenceScore: score,
  };
}

export function calculateReplayConfidence(input: {
  cons: ReplayConsistency;
  par: ReplayParity;
  drift: ReplayDriftReconstruction;
  orderingStable: boolean;
  samples: number;
}): number {
  const base = input.cons.consistentRatio;
  const penalty =
    input.cons.orphanRatio * 0.6 +
    input.cons.inconsistentRatio * 0.4 +
    (input.par.regression ? 0.3 : 0) +
    (input.orderingStable ? 0 : 0.2) +
    (input.drift.severity === 'CRITICAL' ? 0.5 : input.drift.severity === 'HIGH' ? 0.25 : 0);
  const sampleBoost = Math.min(input.samples / 10, 1) * 0.1;
  const parityBoost = (input.par.score / 100) * 0.1;
  const conf = Math.max(0, Math.min(1, base - penalty + sampleBoost + parityBoost));
  return Number(conf.toFixed(3));
}

function scoreToConfidence(score: number): ReplayConfidence {
  if (score >= 0.9) return 'VERY_HIGH';
  if (score >= 0.75) return 'HIGH';
  if (score >= 0.5) return 'MEDIUM';
  if (score > 0) return 'LOW';
  return 'UNKNOWN';
}

/* ---------- Risk ---------- */

export function classifyReplayRisk(input: {
  classification: ReplayClassification;
  parity: ReplayParity;
  propagation: ReplayFailurePropagation;
  drift: ReplayDriftReconstruction;
  severity: ReplaySeverity;
  lineage: ReplayLineage;
}): ReplayRisk {
  if (
    input.classification === 'unreconstructable' ||
    input.lineage.class === 'broken' ||
    input.lineage.class === 'orphaned' ||
    input.drift.severity === 'CRITICAL' ||
    input.severity === 'CRITICAL' ||
    input.propagation.propagation === 'circular'
  ) {
    return 'critical';
  }
  if (
    input.classification === 'divergent' ||
    input.parity.regression ||
    input.drift.severity === 'HIGH' ||
    input.severity === 'HIGH'
  ) {
    return 'high';
  }
  if (input.classification === 'unstable' || input.parity.gap > 15) return 'medium';
  if (input.classification === 'partially_deterministic') return 'low';
  return 'none';
}

/* ---------- Lineage (local helper, full impl in replayLineage.ts) ---------- */

function buildReplayLineage(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): ReplayLineage {
  // mirror to avoid circular import; delegated to replayLineage.ts public API too.
  const flowTraces = flowTracesOf(flow, traces);
  const owners = new Set<string>();
  const mirrors = new Set<string>();
  const finalizers = new Set<string>();
  for (const t of flowTraces) {
    for (const s of t.steps) {
      if (s.mirror) mirrors.add(s.step);
      else owners.add(s.step);
      if (s.step === 'finalize' || s.step === 'finalize_sync') finalizers.add(s.step);
    }
  }
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  const gaps: string[] = [];
  if (reg) {
    for (const e of reg.steps) {
      const observed = flowTraces.some((t) => t.steps.some((s) => s.step === e && s.status === 'ok'));
      if (!observed) gaps.push(e);
    }
  }
  let cls: ReplayLineageClass = 'intact';
  if (mirrors.size > 0 && owners.size === 0) cls = 'mirror_only';
  else if (flowTraces.some((t) => t.orphanRisk)) cls = 'orphaned';
  else if (reg?.requiresFinalize && finalizers.size === 0) cls = 'broken';
  else if (gaps.length > 0 && owners.size > 0) cls = 'degraded';

  const temporalGap = flowTraces.some((t) => t.steps.some((s) => s.status === 'skipped' || s.status === 'aborted'));
  const stateRegression = flowTraces.length >= 2 &&
    flowTraces.slice(1).some((t, i) => {
      const prev = flowTraces[i];
      return prev.consistency === 'consistent' && t.consistency === 'inconsistent';
    });
  return {
    flow,
    class: cls,
    gaps,
    temporalGap,
    stateRegression,
  };
}

function worstSeverityFromTraces(traces: readonly RuntimeWriteTrace[]): ReplaySeverity {
  let worst: ReplaySeverity = 'NONE';
  for (const t of traces) {
    if (SEV_RANK[t.severity] > SEV_RANK[worst]) worst = t.severity;
  }
  return worst;
}
