import { type AggregatedMetric, sigOf } from './observabilityTypes';

export interface DeterminismReport {
  readonly deterministic: boolean;
  readonly signature: string;
}

export function assertMetricDeterminism(
  a: ReadonlyArray<AggregatedMetric>,
  b: ReadonlyArray<AggregatedMetric>,
): DeterminismReport {
  const sa = sigOf(a);
  const sb = sigOf(b);
  return Object.freeze({ deterministic: sa === sb, signature: sa });
}
