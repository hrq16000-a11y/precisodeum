import {
  type ObservabilityCertificate,
  type StabilitySignal,
  type AggregatedMetric,
  deepFreeze,
  sigOf,
} from './observabilityTypes';

export function certifyObservability(
  aggregates: ReadonlyArray<AggregatedMetric>,
  stability: ReadonlyArray<StabilitySignal>,
): ObservabilityCertificate {
  const reasons: string[] = [];
  for (const a of aggregates) {
    if (!Object.isFrozen(a)) reasons.push(`agg-not-frozen:${a.id}`);
    if (!Number.isFinite(a.mean)) reasons.push(`agg-non-finite:${a.id}`);
  }
  for (const s of stability) {
    if (!Object.isFrozen(s)) reasons.push(`stability-not-frozen:${s.id}`);
    if (s.convergence === 'DIVERGENT' || s.convergence === 'COLLAPSED') {
      reasons.push(`unstable:${s.id}:${s.convergence}`);
    }
  }
  const sortedReasons = reasons.slice().sort();
  const out = {
    ok: sortedReasons.length === 0,
    reasons: sortedReasons,
    signature: sigOf({ reasons: sortedReasons }),
  };
  return deepFreeze(out);
}
