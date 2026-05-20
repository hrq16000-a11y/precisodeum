/**
 * Fase 1.9.3 — Barrel (READ-ONLY).
 */
export * from './equilibriumTypes';
export * from './stabilityField';
export * from './runtimeEntropy';
export * from './propagationEnergy';
export * from './equilibriumResolution';
export * from './metastableStates';
export * from './dissipationAnalysis';
export * from './tensionTopology';
export * from './equilibriumCollapse';
export * from './canonicalEquilibrium';
export * from './equilibriumCertification';
export * from './aggregation';
export * from './equilibriumAdapters';
export * from './equilibriumObservability';
export * from './equilibriumExplainers';
export * from './equilibriumGuards';
export * from './assertEquilibriumIntegrity';

import { buildStabilityField } from './stabilityField';
import { calculateRuntimeEntropy } from './runtimeEntropy';
import { calculatePropagationEnergy } from './propagationEnergy';
import { buildTopologyTension } from './tensionTopology';
import { resolveCanonicalEquilibrium } from './equilibriumResolution';
import { detectMetastableState } from './metastableStates';
import { calculateDissipation } from './dissipationAnalysis';
import { detectEquilibriumCollapse } from './equilibriumCollapse';
import { buildCanonicalEquilibrium } from './canonicalEquilibrium';
import { certifyEquilibrium, assertEquilibriumSafety } from './equilibriumCertification';
import type { EquilibriumNode, RuntimeEquilibriumEnvelope } from './equilibriumTypes';

export function buildEquilibriumEnvelope(id: string, nodes: readonly EquilibriumNode[]): RuntimeEquilibriumEnvelope {
  const field = buildStabilityField(nodes);
  const entropy = calculateRuntimeEntropy(field.nodes);
  const propagation = calculatePropagationEnergy(field.nodes);
  const topology = buildTopologyTension(field.nodes);
  const classification = resolveCanonicalEquilibrium(field, entropy, propagation, topology);
  const metastable = detectMetastableState(field, entropy, classification);
  const dissipation = calculateDissipation(entropy, propagation);
  const collapse = detectEquilibriumCollapse(field, topology, classification);
  const canonical = buildCanonicalEquilibrium(field, classification);
  const certification = certifyEquilibrium({ classification, field, entropy, propagation, topology, nodes: field.nodes });
  const risks = assertEquilibriumSafety(certification);
  const score = (field.globalStability + (1 - entropy.score) + propagation.containment + topology.balance) / 4;
  const stable = classification === 'STABLE' && certification.safe;
  return Object.freeze({
    id, field, entropy, propagation, dissipation, topology, metastable, collapse, canonical, classification, certification, risks, score, stable,
  });
}
