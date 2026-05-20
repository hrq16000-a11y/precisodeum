import {
  type MetricSample,
  type TelemetryNode,
  type MetricKind,
  deepFreeze,
  sigOf,
  cloneSorted,
} from './observabilityTypes';

export interface ProductionTelemetryInput {
  readonly samples: ReadonlyArray<MetricSample>;
}

export interface ProductionTelemetry {
  readonly nodes: ReadonlyArray<TelemetryNode>;
  readonly byKind: Readonly<Record<MetricKind, number>>;
  readonly signature: string;
}

const KINDS: ReadonlyArray<MetricKind> = [
  'counter',
  'gauge',
  'ratio',
  'lineage',
  'attribution',
  'conversion',
  'engagement',
  'seo',
  'sponsor',
  'funnel',
  'trace',
];

export function buildProductionTelemetry(
  input: ProductionTelemetryInput,
): ProductionTelemetry {
  const samples = cloneSorted(input.samples, (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const byKind: Record<MetricKind, number> = Object.fromEntries(
    KINDS.map((k) => [k, 0]),
  ) as Record<MetricKind, number>;
  const nodeMap = new Map<string, { id: string; kind: MetricKind; value: number; children: string[] }>();
  for (const s of samples) {
    byKind[s.kind] = (byKind[s.kind] ?? 0) + 1;
    if (!nodeMap.has(s.id)) {
      nodeMap.set(s.id, { id: s.id, kind: s.kind, value: s.value, children: [] });
    }
    for (const p of s.parents ?? []) {
      if (!nodeMap.has(p)) {
        nodeMap.set(p, { id: p, kind: s.kind, value: 0, children: [] });
      }
      const parent = nodeMap.get(p)!;
      if (!parent.children.includes(s.id)) parent.children.push(s.id);
    }
  }
  const nodes: TelemetryNode[] = cloneSorted(Array.from(nodeMap.values()), (a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  ).map((n) => ({
    id: n.id,
    kind: n.kind,
    value: n.value,
    children: cloneSorted(n.children, (a, b) => (a < b ? -1 : a > b ? 1 : 0)),
  }));
  const out = { nodes, byKind, signature: sigOf({ nodes, byKind }) };
  return deepFreeze(out);
}
