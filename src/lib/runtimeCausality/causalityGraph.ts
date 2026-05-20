/**
 * Fase 1.8.3 — Causality graph builder (READ-ONLY).
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import { OPERATION_REGISTRY } from '@/lib/operations/operationRegistry';
import type { RuntimeWriteTrace } from '@/lib/runtimeRecorder/recorderTypes';
import type {
  CausalityClassification,
  CausalitySeverity,
  CausalityStrength,
  FailureOrigin,
  PropagationMode,
  RuntimeBlastCause,
  RuntimeCausalityChain,
  RuntimeCausalityEdge,
  RuntimeCausalityGraph,
  RuntimeCausalityNode,
  RuntimeDriftCause,
  RuntimeFailureCause,
  RuntimeMirrorCause,
  RuntimeOrderingCause,
  RuntimePropagationCause,
  RuntimeReplayCause,
  RuntimeTemporalCause,
} from './causalityTypes';
import { buildCausalityTopology } from './causalityTopology';

const SEV_RANK: Record<CausalitySeverity, number> = {
  NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4,
};

function flowTracesOf(flow: FlowId, traces: readonly RuntimeWriteTrace[]) {
  return traces.filter((t) => t.flow === flow);
}

function nodeId(flow: FlowId, traceIdx: number, step: string, order: number): string {
  return `${flow}#${traceIdx}#${order}#${step}`;
}

export function buildCausalityGraph(traces: readonly RuntimeWriteTrace[]): RuntimeCausalityGraph[] {
  const flows = new Set<FlowId>(traces.map((t) => t.flow));
  return [...flows].map((f) => buildFlowCausality(f, traces));
}

export function buildFlowCausality(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): RuntimeCausalityGraph {
  const ft = flowTracesOf(flow, traces);
  const nodes: RuntimeCausalityNode[] = [];
  const edges: RuntimeCausalityEdge[] = [];

  ft.forEach((t, ti) => {
    const ids = new Map<string, string>();
    for (const s of t.steps) {
      const id = nodeId(flow, ti, s.step, s.order);
      ids.set(s.step, id);
      nodes.push({
        id,
        flow,
        step: s.step,
        mirror: s.mirror,
        failure: s.status === 'failed' || s.status === 'aborted',
      });
    }
    for (const s of t.steps) {
      for (const dep of s.dependsOn) {
        const from = ids.get(dep);
        const to = ids.get(s.step);
        if (!to) continue;
        const hidden = !from;
        edges.push({
          from: from ?? `MISSING:${dep}`,
          to,
          strength: hidden ? 'critical' : s.status === 'failed' ? 'strong' : 'moderate',
          mode: classifyPropagationMode({
            cascaded: !!s.failure?.cascaded,
            mirror: s.mirror,
            hidden,
            self: dep === s.step,
          }),
          hidden,
        });
      }
    }
  });

  const failurePropagation = buildFailurePropagationGraph(flow, ft);
  const temporalDependency = buildTemporalDependencyGraph(flow, ft);
  const replayDependency = buildReplayDependencyGraph(flow, ft);
  const chains = extractCausalityChains(flow, ft, edges);
  const classification = classifyCausalityGraph({ edges, chains, hasOrphan: ft.some((t) => t.orphanRisk) });
  const strength = calculateCausalityStrength(edges);
  const failureCauses = extractFailureCauses(flow, ft);
  const propagation = failurePropagation;
  const temporal = temporalDependency;
  const replay = replayDependency;
  const mirror = buildMirrorCause(flow, ft);
  const ordering = buildOrderingCause(flow, ft);
  const drift = buildDriftCause(flow, ft);
  const blast = buildBlastCause(flow, ft, traces);
  const topology = buildCausalityTopology(flow, ft);
  const severity = derivedSeverity({
    classification, strength, propagation, drift, replay, mirror, ordering, blast, topology,
  });

  return {
    flow,
    nodes,
    edges,
    chains,
    classification,
    strength,
    severity,
    failureCauses,
    propagation,
    temporal,
    mirror,
    ordering,
    replay,
    drift,
    blast,
    topology,
    liveExecutionEnabled: false,
    realUsersAllowed: false,
    retryEnabled: false,
    backgroundEnabled: false,
    currentStage: 'STAGE_0_READ_ONLY',
  };
}

export function buildFailurePropagationGraph(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): RuntimePropagationCause {
  const ft = flowTracesOf(flow, traces);
  const affected = new Set<string>();
  let depth = 0;
  let cascading = false;
  let recursive = false;

  for (const t of ft) {
    for (const s of t.steps) {
      if (s.status === 'failed') {
        affected.add(s.step);
        if (s.failure?.cascaded) {
          cascading = true;
          depth = Math.max(depth, t.steps.filter((x) => x.status === 'aborted' || x.status === 'skipped').length + 1);
        }
      }
      if (s.dependsOn.includes(s.step)) recursive = true;
    }
    if (t.orphanRisk) {
      cascading = true;
      for (const s of t.steps) if (s.mirror) affected.add(s.step);
    }
  }
  const circular = hasCycleInTraces(ft);

  let mode: PropagationMode = 'direct';
  if (circular) mode = 'circular';
  else if (recursive) mode = 'recursive';
  else if (cascading && depth > 1) mode = 'indirect';
  else if (ft.some((t) => t.mirrorDependent)) mode = 'eventual';
  else if (cascading) mode = 'delayed';

  return { flow, mode, depth, affectedSteps: [...affected] };
}

export function buildTemporalDependencyGraph(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): RuntimeTemporalCause {
  const ft = flowTracesOf(flow, traces);
  if (ft.length < 2) {
    return { flow, escalating: false, samples: ft.length, windowDepth: 0 };
  }
  let escalating = false;
  for (let i = 1; i < ft.length; i++) {
    const prev = ft[i - 1];
    const cur = ft[i];
    if (prev.consistency === 'consistent' && (cur.consistency === 'inconsistent' || cur.consistency === 'orphaned')) {
      escalating = true;
    }
    if (SEV_RANK[cur.severity as CausalitySeverity] > SEV_RANK[prev.severity as CausalitySeverity]) {
      escalating = true;
    }
  }
  return { flow, escalating, samples: ft.length, windowDepth: ft.length };
}

export function buildReplayDependencyGraph(
  flow: FlowId,
  traces: readonly RuntimeWriteTrace[],
): RuntimeReplayCause {
  const ft = flowTracesOf(flow, traces);
  if (ft.length === 0) return { flow, divergent: false, unstable: false, regression: false };
  const sigs = new Set(ft.map((t) => t.ordering.actualOrder.join('>')));
  const divergent = ft.some((t) => t.classification === 'DIVERGENT' || t.classification === 'CRITICAL');
  const unstable = sigs.size > 1;
  let regression = false;
  for (let i = 1; i < ft.length; i++) {
    if (ft[i - 1].classification === 'SAFE' && (ft[i].classification === 'DIVERGENT' || ft[i].classification === 'CRITICAL')) {
      regression = true;
    }
  }
  return { flow, divergent, unstable, regression };
}

function buildMirrorCause(flow: FlowId, ft: readonly RuntimeWriteTrace[]): RuntimeMirrorCause {
  const mirrorSteps = new Set<string>();
  let desynced = false;
  for (const t of ft) {
    for (const s of t.steps) if (s.mirror) mirrorSteps.add(s.step);
    if (t.mirrorDependent || t.orphanRisk) desynced = true;
  }
  return { flow, desynced, mirrorSteps: [...mirrorSteps] };
}

function buildOrderingCause(flow: FlowId, ft: readonly RuntimeWriteTrace[]): RuntimeOrderingCause {
  const violations = new Set<string>();
  for (const t of ft) {
    for (const v of t.ordering.violations) violations.add(v);
    if (t.ordering.class !== 'expected') violations.add(t.ordering.class);
  }
  return { flow, violated: violations.size > 0, violations: [...violations] };
}

function buildDriftCause(flow: FlowId, ft: readonly RuntimeWriteTrace[]): RuntimeDriftCause {
  const total = ft.length || 1;
  const orphan = ft.filter((t) => t.orphanRisk).length;
  const inconsistent = ft.filter((t) => t.consistency === 'inconsistent').length;
  const containmentScore = Number((1 - (orphan + inconsistent) / (total * 2)).toFixed(3));
  let escalating = false;
  for (let i = 1; i < ft.length; i++) {
    if (!ft[i - 1].orphanRisk && ft[i].orphanRisk) escalating = true;
  }
  const unbounded = orphan === total && total > 1;
  return { flow, escalating, unbounded, containmentScore };
}

function buildBlastCause(
  flow: FlowId,
  ft: readonly RuntimeWriteTrace[],
  allTraces: readonly RuntimeWriteTrace[],
): RuntimeBlastCause {
  const impacted = new Set<FlowId>();
  const criticalHere = ft.some((t) => t.severity === 'CRITICAL' || t.orphanRisk);
  if (criticalHere) {
    for (const t of allTraces) {
      if (t.flow !== flow && (t.severity === 'HIGH' || t.severity === 'CRITICAL')) impacted.add(t.flow);
    }
  }
  return { flow, escalated: criticalHere && impacted.size > 0, impactedFlows: [...impacted] };
}

function extractFailureCauses(flow: FlowId, ft: readonly RuntimeWriteTrace[]): RuntimeFailureCause[] {
  const out: RuntimeFailureCause[] = [];
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  for (const t of ft) {
    for (const s of t.steps) {
      if (s.status === 'failed' || s.status === 'aborted') {
        out.push({
          flow,
          origin: classifyFailureOrigin({ step: s.step, mirror: s.mirror, ordering: t.ordering.class, requiresOwner: s.requiresOwner }),
          step: s.step,
          strength: s.failure?.cascaded ? 'critical' : 'strong',
        });
      }
    }
    if (t.orphanRisk) out.push({ flow, origin: 'orphan_state', step: 'orphan', strength: 'critical' });
    if (reg?.requiresFinalize && !t.steps.some((s) => (s.step === 'finalize' || s.step === 'finalize_sync') && s.status === 'ok')) {
      out.push({ flow, origin: 'finalize_gap', step: 'finalize', strength: 'moderate' });
    }
  }
  return out;
}

function extractCausalityChains(
  flow: FlowId,
  ft: readonly RuntimeWriteTrace[],
  edges: readonly RuntimeCausalityEdge[],
): RuntimeCausalityChain[] {
  const chains: RuntimeCausalityChain[] = [];
  for (const t of ft) {
    const path = t.steps.map((s) => s.step);
    let cls: CausalityClassification = 'dependent';
    if (path.length <= 1) cls = 'isolated';
    if (t.steps.some((s) => s.dependsOn.includes(s.step))) cls = 'recursive';
    if (edges.some((e) => e.hidden)) cls = 'hidden';
    if (hasCycleInTraces([t])) cls = 'circular';
    chains.push({ flow, path, classification: cls, depth: path.length });
  }
  return chains;
}

export function classifyCausalityGraph(input: {
  edges: readonly RuntimeCausalityEdge[];
  chains: readonly RuntimeCausalityChain[];
  hasOrphan: boolean;
}): CausalityClassification {
  if (input.chains.some((c) => c.classification === 'circular')) return 'circular';
  if (input.chains.some((c) => c.classification === 'recursive')) return 'recursive';
  if (input.edges.some((e) => e.hidden)) return 'hidden';
  if (input.hasOrphan) return 'cascading';
  if (input.edges.length === 0) return 'isolated';
  return 'dependent';
}

export function classifyPropagationMode(input: {
  cascaded: boolean;
  mirror: boolean;
  hidden: boolean;
  self: boolean;
}): PropagationMode {
  if (input.self) return 'recursive';
  if (input.hidden) return 'indirect';
  if (input.mirror) return 'eventual';
  if (input.cascaded) return 'delayed';
  return 'direct';
}

export function classifyFailureOrigin(input: {
  step: string;
  mirror: boolean;
  ordering: string;
  requiresOwner: boolean;
}): FailureOrigin {
  if (input.ordering !== 'expected') return 'ordering_violation';
  if (input.mirror) return 'mirror_desync';
  if (input.requiresOwner) return 'owner_missing';
  if (input.step.includes('finalize')) return 'finalize_gap';
  return 'stale_projection';
}

export function calculateCausalityStrength(edges: readonly RuntimeCausalityEdge[]): CausalityStrength {
  if (edges.length === 0) return 'none';
  const rank: Record<CausalityStrength, number> = { none: 0, weak: 1, moderate: 2, strong: 3, critical: 4 };
  let worst: CausalityStrength = 'weak';
  for (const e of edges) {
    if (rank[e.strength] > rank[worst]) worst = e.strength;
  }
  return worst;
}

export function calculatePropagationDepth(graph: RuntimeCausalityGraph): number {
  return graph.propagation.depth;
}

function derivedSeverity(input: {
  classification: CausalityClassification;
  strength: CausalityStrength;
  propagation: RuntimePropagationCause;
  drift: RuntimeDriftCause;
  replay: RuntimeReplayCause;
  mirror: RuntimeMirrorCause;
  ordering: RuntimeOrderingCause;
  blast: RuntimeBlastCause;
  topology: { risk: CausalitySeverity };
}): CausalitySeverity {
  if (
    input.classification === 'circular' ||
    input.drift.unbounded ||
    input.blast.escalated ||
    input.replay.regression
  ) return 'CRITICAL';
  if (
    input.classification === 'recursive' ||
    input.classification === 'hidden' ||
    input.mirror.desynced ||
    input.replay.divergent ||
    input.propagation.mode === 'recursive'
  ) return 'HIGH';
  if (
    input.classification === 'cascading' ||
    input.ordering.violated ||
    input.replay.unstable
  ) return 'MEDIUM';
  if (input.classification === 'dependent') return 'LOW';
  return 'NONE';
}

function hasCycleInTraces(traces: readonly RuntimeWriteTrace[]): boolean {
  const adj = new Map<string, Set<string>>();
  for (const t of traces) {
    for (const s of t.steps) {
      for (const dep of s.dependsOn) {
        if (!adj.has(dep)) adj.set(dep, new Set());
        adj.get(dep)!.add(s.step);
      }
    }
  }
  const W = 0, G = 1, B = 2;
  const color = new Map<string, number>();
  function dfs(n: string): boolean {
    color.set(n, G);
    for (const m of adj.get(n) ?? []) {
      const c = color.get(m) ?? W;
      if (c === G) return true;
      if (c === W && dfs(m)) return true;
    }
    color.set(n, B);
    return false;
  }
  for (const n of adj.keys()) {
    if ((color.get(n) ?? W) === W && dfs(n)) return true;
  }
  return false;
}
