/**
 * Fase 1.7.7 — Shadow comparison (READ-ONLY).
 *
 * Compara estruturalmente: legacy plan, atomic plan, blueprint plan e
 * rollback plan — sem executar nada.
 */

import {
  OPERATION_REGISTRY,
  type FlowId,
  type FlowRegistration,
} from '@/lib/operations/operationRegistry';
import { getFlowDriftProfile } from '@/lib/drift/driftRegistry';
import { buildOperationBlueprint } from '@/lib/atomicBlueprint/operationBlueprints';
import { simulateFlow } from './simulateAtomicExecution';
import type { ShadowComparisonReport } from './simulationTypes';

export function buildShadowComparison(flow: FlowId): ShadowComparisonReport | null {
  const reg = OPERATION_REGISTRY.find((r) => r.flow === flow);
  if (!reg) return null;
  const sim = simulateFlow(flow);
  if (!sim) return null;
  const bp = buildOperationBlueprint(reg);
  const profile = getFlowDriftProfile(flow);

  const legacySteps = sim.legacy.steps.map((s) => s.step);
  const atomicSteps = sim.atomic.steps.map((s) => s.step);
  const blueprintSteps = bp.current_write_order;

  const missingSteps = blueprintSteps.filter((s) => !atomicSteps.includes(s));
  const unsafeReorder = !legacySteps.every((s, i) => atomicSteps[i] === s);

  const hiddenDependencies: string[] = [];
  if (reg.requiresProgressSync && !blueprintSteps.includes('progress')) {
    hiddenDependencies.push('onboarding_progress.columns');
  }
  if (profile?.depends_on_mirror && !blueprintSteps.includes('mirror')) {
    hiddenDependencies.push('profiles<->providers_mirror');
  }
  if (reg.requiresFinalize && !blueprintSteps.includes('finalize')) {
    hiddenDependencies.push('finalizeOnboarding');
  }

  const unsafeMirror =
    !!profile?.depends_on_mirror && !sim.atomic.steps.some((s) => s.atomic);
  const finalizeMismatch =
    reg.requiresFinalize && !sim.atomic.steps.some((s) => s.step === 'finalize');
  const trackerMismatch = sim.legacy.consistency.length !== sim.atomic.consistency.length;

  return {
    flow,
    legacyPlan: sim.legacy,
    atomicPlan: sim.atomic,
    missingSteps,
    unsafeReorder,
    hiddenDependencies,
    unsafeMirror,
    finalizeMismatch,
    trackerMismatch,
  };
}

export function buildAllShadowComparisons(): Record<FlowId, ShadowComparisonReport> {
  const out = {} as Record<FlowId, ShadowComparisonReport>;
  for (const r of OPERATION_REGISTRY) {
    const rep = buildShadowComparison(r.flow);
    if (rep) out[r.flow] = rep;
  }
  return out;
}

export function summarizeShadowComparisons(): {
  totalFlows: number;
  unsafeReorder: number;
  unsafeMirror: number;
  finalizeMismatch: number;
  hiddenDependencyFlows: number;
} {
  const all = buildAllShadowComparisons();
  let unsafeReorder = 0;
  let unsafeMirror = 0;
  let finalizeMismatch = 0;
  let hiddenDependencyFlows = 0;
  for (const r of Object.values(all)) {
    if (r.unsafeReorder) unsafeReorder += 1;
    if (r.unsafeMirror) unsafeMirror += 1;
    if (r.finalizeMismatch) finalizeMismatch += 1;
    if (r.hiddenDependencies.length > 0) hiddenDependencyFlows += 1;
  }
  return {
    totalFlows: Object.keys(all).length,
    unsafeReorder,
    unsafeMirror,
    finalizeMismatch,
    hiddenDependencyFlows,
  };
}
