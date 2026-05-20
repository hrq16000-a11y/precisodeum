import type { RuntimeNaturalComposition, RuntimeNaturalIdentity, RuntimeNaturalNormalization, RuntimeNaturalStability, RuntimeNaturalTopology, StabilityClass } from './naturalTransformationTypes';

export function buildNaturalStability(
  composition: RuntimeNaturalComposition,
  identity: RuntimeNaturalIdentity,
  normalization: RuntimeNaturalNormalization,
  topology: RuntimeNaturalTopology,
): RuntimeNaturalStability {
  const score = (composition.associativity + identity.preservation + normalization.stability + topology.connectivity) / 4;
  let cls: StabilityClass = 'STABLE';
  if (score <= 0.15) cls = 'COLLAPSED';
  else if (score < 0.4) cls = 'UNSTABLE';
  else if (score < 0.8) cls = 'WEAK';
  return Object.freeze({ class: cls, score, unstable: cls === 'UNSTABLE' || cls === 'COLLAPSED', collapsed: cls === 'COLLAPSED' });
}
