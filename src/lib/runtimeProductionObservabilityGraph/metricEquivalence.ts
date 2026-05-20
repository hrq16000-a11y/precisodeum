import { type AggregatedMetric, sigOf } from './observabilityTypes';

export function metricsEquivalent(
  a: ReadonlyArray<AggregatedMetric>,
  b: ReadonlyArray<AggregatedMetric>,
): boolean {
  return sigOf(a) === sigOf(b);
}

export function equivalenceClass(
  groups: ReadonlyArray<ReadonlyArray<AggregatedMetric>>,
): ReadonlyArray<string> {
  const sigs = groups.map((g) => sigOf(g));
  const out = Array.from(new Set(sigs)).sort();
  return Object.freeze(out);
}
