/**
 * Fase 1.7.6 — Dependency requirements (READ-ONLY).
 * Derivado do OPERATION_REGISTRY + FLOW_DRIFT_PROFILES.
 */

import {
  OPERATION_REGISTRY,
  type FlowId,
  type FlowRegistration,
} from '@/lib/operations/operationRegistry';
import { getFlowDriftProfile } from '@/lib/drift/driftRegistry';
import type { DependencyRequirement } from './atomicBlueprintTypes';

export function deriveDependencyRequirements(
  reg: FlowRegistration,
): DependencyRequirement[] {
  const profile = getFlowDriftProfile(reg.flow);
  const out: DependencyRequirement[] = [];

  out.push({
    kind: 'ownership',
    description: `ownership=${reg.ownership}`,
    required: true,
  });

  if (profile?.depends_on_mirror) {
    out.push({
      kind: 'mirror',
      description: 'flow depende de mirror profiles<->providers',
      required: true,
    });
  }
  if (reg.requiresFinalize) {
    out.push({
      kind: 'finalize',
      description: 'finalizeOnboarding (ou equivalente) deve rodar',
      required: true,
    });
  }
  if (reg.requiresProgressSync) {
    out.push({
      kind: 'progress',
      description: 'onboarding_progress columns devem ser sincronizadas',
      required: true,
    });
  }
  for (const fx of reg.sideEffects) {
    out.push({
      kind: 'external_side_effect',
      description: fx,
      required: false,
    });
  }
  // idempotency derivada do número de steps + retry-friendly strategy
  out.push({
    kind: 'idempotency',
    description: reg.steps.length > 1
      ? 'multi-step exige chave idempotente por write'
      : 'single-step naturalmente idempotente',
    required: reg.steps.length > 1,
  });

  return out;
}

export function getAllDependencyRequirements(): Record<FlowId, DependencyRequirement[]> {
  const out = {} as Record<FlowId, DependencyRequirement[]>;
  for (const r of OPERATION_REGISTRY) {
    out[r.flow] = deriveDependencyRequirements(r);
  }
  return out;
}
