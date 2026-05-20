import type { RuntimeFunctorComposition, RuntimeFunctorIdentity, RuntimeFunctorNormalization, RuntimeFunctorStability, RuntimeFunctorTopology, StabilityClass } from './functorTypes';

export function buildFunctorStability(
  composition: RuntimeFunctorComposition,
  identity: RuntimeFunctorIdentity,
  normalization: RuntimeFunctorNormalization,
  topology: RuntimeFunctorTopology,
): RuntimeFunctorStability {
  const score = (composition.associativity + identity.preservation + normalization.stability + topology.connectivity) / 4;
  let cls: StabilityClass = 'STABLE';
  if (score <= 0.15) cls = 'COLLAPSED';
  else if (score < 0.4) cls = 'UNSTABLE';
  else if (score < 0.8) cls = 'WEAK';
  return Object.freeze({ class: cls, score, unstable: cls === 'UNSTABLE' || cls === 'COLLAPSED', collapsed: cls === 'COLLAPSED' });
}
