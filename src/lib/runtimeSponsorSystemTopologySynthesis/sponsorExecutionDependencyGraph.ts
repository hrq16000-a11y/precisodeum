/**
 * Phase 1.9.25 — Sponsor Execution Dependency Graph.
 * Derives a deterministic execution dependency DAG from the topology graph.
 */
import {
  deepFreeze,
  signObject,
  type SponsorTopologyLayerId,
} from './sponsorTopologyInternals';
import type {
  SponsorSystemTopologyGraph,
  SponsorTopologyEdge,
} from './sponsorSystemTopologyGraph';

export interface SponsorExecutionDependencyNode {
  readonly id: SponsorTopologyLayerId;
  readonly dependsOn: ReadonlyArray<SponsorTopologyLayerId>;
  readonly observedBy: ReadonlyArray<SponsorTopologyLayerId>;
  readonly nodeSignature: string;
}

export interface SponsorExecutionDependencyEdge {
  readonly from: SponsorTopologyLayerId;
  readonly to: SponsorTopologyLayerId;
  readonly kind: SponsorTopologyEdge['kind'];
  readonly edgeSignature: string;
}

export interface SponsorExecutionDependencyGraph {
  readonly nodes: ReadonlyArray<SponsorExecutionDependencyNode>;
  readonly edges: ReadonlyArray<SponsorExecutionDependencyEdge>;
  readonly topologicalOrder: ReadonlyArray<SponsorTopologyLayerId>;
  readonly graphSignature: string;
}

export function resolveExecutionDependencies(
  topology: SponsorSystemTopologyGraph,
): SponsorExecutionDependencyGraph {
  const dependsOn = new Map<SponsorTopologyLayerId, Set<SponsorTopologyLayerId>>();
  const observedBy = new Map<SponsorTopologyLayerId, Set<SponsorTopologyLayerId>>();

  for (const n of topology.nodes) {
    dependsOn.set(n.id, new Set());
    observedBy.set(n.id, new Set());
  }

  for (const e of topology.edges) {
    if (e.kind === 'sequence') {
      dependsOn.get(e.to)!.add(e.from);
    } else {
      // observation / control: target observes source (read-only)
      observedBy.get(e.from)!.add(e.to);
      dependsOn.get(e.to)!.add(e.from);
    }
  }

  // Kahn's algorithm with canonical ordering by layer id.
  const indeg = new Map<SponsorTopologyLayerId, number>();
  for (const [k, v] of dependsOn) indeg.set(k, v.size);
  const order: SponsorTopologyLayerId[] = [];
  const remaining = new Set<SponsorTopologyLayerId>(indeg.keys());

  while (remaining.size > 0) {
    const ready = [...remaining].filter((k) => (indeg.get(k) ?? 0) === 0).sort();
    if (ready.length === 0) {
      // No cycles expected in canonical topology; fail-closed.
      throw new Error('[sponsor-topology] cycle detected in execution dependency graph');
    }
    for (const id of ready) {
      order.push(id);
      remaining.delete(id);
      for (const [k, deps] of dependsOn) {
        if (deps.has(id)) indeg.set(k, (indeg.get(k) ?? 1) - 1);
      }
    }
  }

  const nodes: SponsorExecutionDependencyNode[] = topology.nodes
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((n) => {
      const deps = [...(dependsOn.get(n.id) ?? new Set())].sort();
      const obs = [...(observedBy.get(n.id) ?? new Set())].sort();
      const nodeSignature = signObject({ id: n.id, dependsOn: deps, observedBy: obs });
      return Object.freeze({
        id: n.id,
        dependsOn: Object.freeze(deps),
        observedBy: Object.freeze(obs),
        nodeSignature,
      });
    });

  const edges: SponsorExecutionDependencyEdge[] = topology.edges.map((e) =>
    Object.freeze({
      from: e.from,
      to: e.to,
      kind: e.kind,
      edgeSignature: e.edgeSignature,
    }),
  );

  const graphSignature = signObject({
    order,
    nodes: nodes.map((n) => n.nodeSignature),
    edges: edges.map((e) => e.edgeSignature),
  });

  return deepFreeze({
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
    topologicalOrder: Object.freeze(order),
    graphSignature,
  });
}
