import {
  type MetricSample,
  type AggregatedMetric,
  type MetricKind,
  deepFreeze,
  sigOf,
  cloneSorted,
} from './observabilityTypes';

export function aggregateMetrics(
  samples: ReadonlyArray<MetricSample>,
): ReadonlyArray<AggregatedMetric> {
  const acc = new Map<string, { kind: MetricKind; total: number; count: number }>();
  for (const s of samples) {
    const key = `${s.kind}::${s.id}`;
    const cur = acc.get(key) ?? { kind: s.kind, total: 0, count: 0 };
    cur.total += s.value * (s.weight ?? 1);
    cur.count += 1;
    acc.set(key, cur);
  }
  const entries = Array.from(acc.entries()).map(([key, v]) => {
    const id = key.split('::').slice(1).join('::');
    const mean = v.count > 0 ? v.total / v.count : 0;
    const item = { id, kind: v.kind, total: v.total, count: v.count, mean, signature: '' };
    item.signature = sigOf({ id, kind: v.kind, total: v.total, count: v.count, mean });
    return item;
  });
  const sorted = cloneSorted(entries, (a, b) =>
    a.kind === b.kind ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : a.kind < b.kind ? -1 : 1,
  );
  return deepFreeze(sorted) as ReadonlyArray<AggregatedMetric>;
}
