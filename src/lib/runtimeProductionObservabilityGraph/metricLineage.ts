import {
  type LineageEdge,
  deepFreeze,
  sigOf,
  cloneSorted,
} from './observabilityTypes';
import { type ProductionTelemetry } from './productionTelemetry';

export interface MetricLineage {
  readonly edges: ReadonlyArray<LineageEdge>;
  readonly roots: ReadonlyArray<string>;
  readonly signature: string;
}

export function buildMetricLineage(telemetry: ProductionTelemetry): MetricLineage {
  const edges: LineageEdge[] = [];
  const childrenOf = new Set<string>();
  for (const n of telemetry.nodes) {
    for (const c of n.children) {
      edges.push({ from: n.id, to: c, weight: 1 });
      childrenOf.add(c);
    }
  }
  const roots = telemetry.nodes
    .filter((n) => !childrenOf.has(n.id))
    .map((n) => n.id);
  const sortedEdges = cloneSorted(edges, (a, b) =>
    a.from === b.from ? (a.to < b.to ? -1 : a.to > b.to ? 1 : 0) : a.from < b.from ? -1 : 1,
  );
  const sortedRoots = cloneSorted(roots, (a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const out = { edges: sortedEdges, roots: sortedRoots, signature: sigOf({ edges: sortedEdges, roots: sortedRoots }) };
  return deepFreeze(out);
}
