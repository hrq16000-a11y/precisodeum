import {
  type MetricSample,
  deepFreeze,
  cloneSorted,
} from './observabilityTypes';

export function normalizeMetrics(
  samples: ReadonlyArray<MetricSample>,
): ReadonlyArray<MetricSample> {
  const dedup = new Map<string, MetricSample>();
  for (const s of samples) {
    const key = `${s.kind}::${s.id}`;
    const parents = cloneSorted([...(s.parents ?? [])], (a, b) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    const tags = cloneSorted([...(s.tags ?? [])], (a, b) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    const value = Number.isFinite(s.value) ? s.value : 0;
    const weight = s.weight === undefined ? undefined : Number.isFinite(s.weight) ? s.weight : 1;
    const norm: MetricSample = {
      id: s.id,
      kind: s.kind,
      value,
      ...(weight !== undefined ? { weight } : {}),
      tags,
      parents,
    };
    dedup.set(key, norm);
  }
  const out = cloneSorted(Array.from(dedup.values()), (a, b) =>
    a.kind === b.kind ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : a.kind < b.kind ? -1 : 1,
  );
  return deepFreeze(out);
}
