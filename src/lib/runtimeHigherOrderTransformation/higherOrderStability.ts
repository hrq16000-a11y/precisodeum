import type { RuntimeHigherOrderComposition, RuntimeHigherOrderIdentity, RuntimeHigherOrderNormalization, RuntimeHigherOrderStability, RuntimeHigherOrderTopology, StabilityClass } from './higherOrderTypes';

export function buildHigherOrderStability(
  composition: RuntimeHigherOrderComposition,
  identity: RuntimeHigherOrderIdentity,
  normalization: RuntimeHigherOrderNormalization,
  topology: RuntimeHigherOrderTopology,
): RuntimeHigherOrderStability {
  const score = (composition.associativity + identity.preservation + normalization.stability + topology.connectivity) / 4;
  let cls: StabilityClass = 'STABLE';
  if (score <= 0.15) cls = 'COLLAPSED';
  else if (score < 0.4) cls = 'UNSTABLE';
  else if (score < 0.8) cls = 'WEAK';
  return Object.freeze({ class: cls, score, unstable: cls === 'UNSTABLE' || cls === 'COLLAPSED', collapsed: cls === 'COLLAPSED' });
}
