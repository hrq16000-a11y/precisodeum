export * from './manifoldTypes';
export * from './stabilityContinuum';
export * from './equilibriumManifold';
export * from './topologicalContinuity';
export * from './propagationGeodesics';
export * from './continuityMetrics';
export * from './deformationContinuum';
export * from './convergenceContinuity';
export * from './continuousSingularities';
export * from './manifoldCollapse';
export * from './manifoldCertification';
export * from './aggregation';
export * from './manifoldAdapters';
export * from './manifoldObservability';
export * from './manifoldExplainers';
export * from './manifoldGuards';
export * from './assertManifoldIntegrity';

import { buildStabilityContinuum } from './stabilityContinuum';
import { buildEquilibriumManifold } from './equilibriumManifold';
import { calculateTopologicalContinuity } from './topologicalContinuity';
import { calculatePropagationGeodesics } from './propagationGeodesics';
import { calculateContinuityMetrics } from './continuityMetrics';
import { buildDeformationContinuum } from './deformationContinuum';
import { detectContinuousSingularity } from './continuousSingularities';
import { buildManifoldCollapse } from './manifoldCollapse';
import { certifyManifoldStability, assertManifoldSafety } from './manifoldCertification';
import type { ManifoldNode, ManifoldStabilityClass, RuntimeManifoldEnvelope } from './manifoldTypes';

export function buildManifoldEnvelope(id: string, nodes: readonly ManifoldNode[]): RuntimeManifoldEnvelope {
  const continuum = buildStabilityContinuum(nodes);
  const manifold = buildEquilibriumManifold(continuum.nodes);
  const continuity = calculateTopologicalContinuity(continuum.nodes);
  const geodesic = calculatePropagationGeodesics(continuum.nodes);
  const metric = calculateContinuityMetrics(continuum.nodes);
  const deformation = buildDeformationContinuum(continuum.nodes);
  const singularity = detectContinuousSingularity(continuum.nodes);
  const collapse = buildManifoldCollapse(continuum, continuity, deformation);
  let classification: ManifoldStabilityClass = 'STABLE';
  if (singularity.terminal || singularity.class === 'RECURSIVE') classification = 'SINGULAR';
  else if (continuity.class === 'FRACTURED' || continuity.class === 'COLLAPSED' || deformation.irreversible) classification = 'FRACTURED';
  else if (geodesic.infinite || geodesic.recursive || continuity.class === 'DISCONTINUOUS') classification = 'DISTORTED';
  else if (continuity.class === 'WEAKLY_CONTINUOUS' || deformation.deformation === 'ELASTIC' || manifold.unstable) classification = 'CONTINUOUS';
  const certification = certifyManifoldStability({ nodes: continuum.nodes, classification, continuity, geodesic, deformation, singularity });
  const risks = assertManifoldSafety(certification);
  const score = (continuum.balance + continuity.strength + metric.score + geodesic.containment) / 4;
  const stable = classification === 'STABLE' && certification.safe;
  return Object.freeze({ id, continuum, manifold, continuity, geodesic, metric, deformation, singularity, collapse, classification, certification, risks, score, stable });
}
