import {
  type TelemetryGraph,
  type TelemetryNode,
  deepFreeze,
  sigOf,
  cloneSorted,
} from './observabilityTypes';
import { type ProductionTelemetry } from './productionTelemetry';

export function buildTelemetryTopology(telemetry: ProductionTelemetry): TelemetryGraph {
  const nodes: TelemetryNode[] = telemetry.nodes.map((n) => ({
    id: n.id,
    kind: n.kind,
    value: n.value,
    children: n.children.slice(),
  }));
  const edges: Array<readonly [string, string]> = [];
  for (const n of nodes) {
    for (const c of n.children) edges.push([n.id, c] as const);
  }
  const sortedEdges = cloneSorted(edges, (a, b) => {
    if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
    return a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0;
  });
  const out: TelemetryGraph = {
    nodes,
    edges: sortedEdges,
    signature: sigOf({ nodes, edges: sortedEdges }),
  };
  return deepFreeze(out);
}
