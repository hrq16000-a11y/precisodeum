import {
  type AggregatedMetric,
  type StabilitySignal,
  type ConvergenceClass,
  deepFreeze,
  sigOf,
  cloneSorted,
} from './observabilityTypes';

export function computeStabilitySignals(
  series: ReadonlyArray<{ id: string; values: ReadonlyArray<number> }>,
): ReadonlyArray<StabilitySignal> {
  const out: StabilitySignal[] = series.map((s) => {
    const vals = s.values.slice();
    if (vals.length === 0) {
      return { id: s.id, convergence: 'COLLAPSED' as ConvergenceClass, variance: 0, signature: sigOf({ id: s.id }) };
    }
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / vals.length;
    let convergence: ConvergenceClass;
    const last = vals[vals.length - 1];
    const first = vals[0];
    if (variance === 0) convergence = 'CONVERGED';
    else if (variance < 0.05) convergence = 'STABLE';
    else if (Math.abs(last - first) > 2 * Math.sqrt(variance)) convergence = 'DIVERGENT';
    else convergence = 'OSCILLATING';
    return {
      id: s.id,
      convergence,
      variance,
      signature: sigOf({ id: s.id, convergence, variance }),
    };
  });
  const sorted = cloneSorted(out, (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return deepFreeze(sorted);
}

export function detectMetricCollapse(
  aggregates: ReadonlyArray<AggregatedMetric>,
): ReadonlyArray<string> {
  return Object.freeze(
    aggregates.filter((a) => a.count === 0 || !Number.isFinite(a.mean)).map((a) => a.id),
  );
}
