/**
 * Fase 1.7.5 — Architectural Dependency Graph (PURE, READ-ONLY).
 *
 * Mapeia dependências estruturais entre flows e capabilities:
 *  flow → boundary, ownership, telemetry, tracker, readiness, mirrors, execution.
 *
 * Determinístico. Sem Supabase, hooks, timers, fetch, window/localStorage.
 */

import {
  OPERATION_REGISTRY,
  type BoundaryId,
  type FlowId,
  type FlowRegistration,
  type Readiness,
} from '@/lib/operations/operationRegistry';
import { getFlowDriftProfile } from '@/lib/drift/driftRegistry';
import type { ContactOwner } from '@/lib/contactOwnership';

export interface FlowDependencyNode {
  flow: FlowId;
  boundary: BoundaryId;
  ownership: ContactOwner | 'mixed';
  readiness: Readiness;
  hasTracker: boolean;
  hasTelemetry: boolean;
  hasMirror: boolean;
  hasExecution: boolean;
  /** Outras capabilities/flows referenciadas. */
  dependsOn: string[];
}

export interface DependencyGraph {
  nodes: FlowDependencyNode[];
  edges: Array<{ from: FlowId; to: string }>;
}

const TRACKER_BOUNDARIES = new Set<BoundaryId>([
  'multiWriteSync',
  'avatarSync',
  'onboardingProgressSync',
  'adminWriteBoundary',
]);

function dependenciesFor(reg: FlowRegistration): string[] {
  const out: string[] = [];
  out.push(`boundary:${reg.boundary}`);
  out.push(`ownership:${reg.ownership}`);
  out.push(`readiness:${reg.readiness}`);
  for (const dep of reg.dependencies) out.push(`schema:${dep}`);
  for (const fx of reg.sideEffects) out.push(`side_effect:${fx}`);
  if (reg.builder) out.push(`builder:${reg.builder}`);
  const profile = getFlowDriftProfile(reg.flow);
  if (profile?.depends_on_mirror) out.push('mirror:required');
  if (profile?.depends_on_eventual_sync) out.push('sync:eventual');
  return out;
}

export function buildDependencyGraph(): DependencyGraph {
  const nodes: FlowDependencyNode[] = [];
  const edges: Array<{ from: FlowId; to: string }> = [];
  for (const r of OPERATION_REGISTRY) {
    const profile = getFlowDriftProfile(r.flow);
    const deps = dependenciesFor(r);
    nodes.push({
      flow: r.flow,
      boundary: r.boundary,
      ownership: r.ownership,
      readiness: r.readiness,
      hasTracker: TRACKER_BOUNDARIES.has(r.boundary),
      hasTelemetry: true, // 1.7.4 cobre todos
      hasMirror: !!profile?.depends_on_mirror,
      hasExecution: r.supportsAtomic,
      dependsOn: deps,
    });
    for (const d of deps) edges.push({ from: r.flow, to: d });
  }
  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Dependency analyses
// ---------------------------------------------------------------------------

/** Procura ciclos no grafo (flow → side_effect:other_flow → ...). */
export function detectCircularDependencies(graph: DependencyGraph): FlowId[][] {
  const cycles: FlowId[][] = [];
  const flows = new Set(graph.nodes.map((n) => n.flow));
  const adj = new Map<FlowId, FlowId[]>();
  for (const n of graph.nodes) {
    const refs = n.dependsOn
      .map((d) => d.replace(/^(side_effect|builder|boundary|ownership|readiness|schema|mirror|sync):/, ''))
      .filter((s) => flows.has(s as FlowId)) as FlowId[];
    adj.set(n.flow, refs);
  }
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<FlowId, number>();
  for (const n of graph.nodes) color.set(n.flow, WHITE);
  const stack: FlowId[] = [];

  function dfs(u: FlowId) {
    color.set(u, GRAY);
    stack.push(u);
    for (const v of adj.get(u) ?? []) {
      const c = color.get(v);
      if (c === GRAY) {
        const idx = stack.indexOf(v);
        if (idx >= 0) cycles.push(stack.slice(idx).concat(v));
      } else if (c === WHITE) dfs(v);
    }
    stack.pop();
    color.set(u, BLACK);
  }
  for (const n of graph.nodes) {
    if (color.get(n.flow) === WHITE) dfs(n.flow);
  }
  return cycles;
}

export interface MissingDependency {
  flow: FlowId;
  missing: 'boundary' | 'tracker' | 'telemetry' | 'execution' | 'ownership';
  reason: string;
}

export function detectMissingDependencies(graph: DependencyGraph): MissingDependency[] {
  const out: MissingDependency[] = [];
  for (const n of graph.nodes) {
    if (n.boundary === 'inline_call_site') {
      out.push({ flow: n.flow, missing: 'boundary', reason: 'inline call-site has no canonical boundary' });
    }
    if (!n.hasTracker && n.boundary !== 'inline_call_site') {
      out.push({ flow: n.flow, missing: 'tracker', reason: `boundary ${n.boundary} has no tracker` });
    }
    if (!n.hasTelemetry) {
      out.push({ flow: n.flow, missing: 'telemetry', reason: 'flow not covered by runtime telemetry' });
    }
    if (!n.hasExecution) {
      out.push({ flow: n.flow, missing: 'execution', reason: 'flow does not support atomic execution' });
    }
    if (!n.ownership) {
      out.push({ flow: n.flow, missing: 'ownership', reason: 'ownership unresolved' });
    }
  }
  return out;
}

export interface OvercoupledFlow {
  flow: FlowId;
  dependencyCount: number;
  sideEffectCount: number;
}

export function detectOvercoupling(graph: DependencyGraph): OvercoupledFlow[] {
  const out: OvercoupledFlow[] = [];
  for (const n of graph.nodes) {
    const sideEffects = n.dependsOn.filter((d) => d.startsWith('side_effect:')).length;
    if (n.dependsOn.length >= 10 || sideEffects >= 3) {
      out.push({ flow: n.flow, dependencyCount: n.dependsOn.length, sideEffectCount: sideEffects });
    }
  }
  return out;
}
