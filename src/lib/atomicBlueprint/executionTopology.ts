/**
 * Fase 1.7.6 — Execution topology (READ-ONLY).
 * Representação estrutural — não executa nada.
 */

import {
  OPERATION_REGISTRY,
  type FlowId,
  type FlowRegistration,
} from '@/lib/operations/operationRegistry';
import { getFlowDriftProfile } from '@/lib/drift/driftRegistry';
import type { TopologyKind, TopologyNode } from './atomicBlueprintTypes';

function classifyStep(
  step: string,
  reg: FlowRegistration,
  hasMirror: boolean,
): TopologyKind {
  if (step === 'finalize') return 'post_commit_effect';
  if (step === 'avatar') return hasMirror ? 'mirror_propagation' : 'eventual_sync';
  if (reg.steps.length === 1) return 'atomic_required';
  // Multi-write step
  if (reg.supportsAtomic) return 'atomic_required';
  return 'sequential';
}

export function deriveTopology(reg: FlowRegistration): TopologyNode[] {
  const profile = getFlowDriftProfile(reg.flow);
  const hasMirror = !!profile?.depends_on_mirror;
  const nodes: TopologyNode[] = reg.steps.map((step) => ({
    step,
    kind: classifyStep(step, reg, hasMirror),
    safeRetry: step === 'finalize' || step === 'avatar' || reg.steps.length === 1,
  }));
  return nodes;
}

export function getAllTopologies(): Record<FlowId, TopologyNode[]> {
  const out = {} as Record<FlowId, TopologyNode[]>;
  for (const r of OPERATION_REGISTRY) out[r.flow] = deriveTopology(r);
  return out;
}

export interface TopologySummary {
  total_steps: number;
  atomic_required: number;
  sequential: number;
  post_commit: number;
  mirror_propagation: number;
  eventual_sync: number;
}

export function summarizeTopology(): TopologySummary {
  const all = getAllTopologies();
  const sum: TopologySummary = {
    total_steps: 0,
    atomic_required: 0,
    sequential: 0,
    post_commit: 0,
    mirror_propagation: 0,
    eventual_sync: 0,
  };
  for (const nodes of Object.values(all)) {
    for (const n of nodes) {
      sum.total_steps += 1;
      if (n.kind === 'atomic_required') sum.atomic_required += 1;
      else if (n.kind === 'sequential') sum.sequential += 1;
      else if (n.kind === 'post_commit_effect') sum.post_commit += 1;
      else if (n.kind === 'mirror_propagation') sum.mirror_propagation += 1;
      else if (n.kind === 'eventual_sync') sum.eventual_sync += 1;
    }
  }
  return sum;
}
