/**
 * Fase 1.7.5 — Mutation Policy Registry (PURE, READ-ONLY).
 *
 * Formaliza quem pode mutar o quê. Cada flow/boundary recebe uma policy.
 * Determinístico. Sem Supabase, hooks, timers, fetch.
 */

import {
  OPERATION_REGISTRY,
  type BoundaryId,
  type FlowId,
  type FlowRegistration,
} from '@/lib/operations/operationRegistry';
import { getFlowDriftProfile } from '@/lib/drift/driftRegistry';
import { classifyFlowRegistration } from '@/lib/drift/writeClassification';
import { isQuarantinedFlow } from '@/lib/drift/quarantineRegistry';
import type { ContactOwner } from '@/lib/contactOwnership';
import type { MutationPolicyId } from './contractTypes';

export interface MutationPolicyDefinition {
  id: MutationPolicyId;
  description: string;
  allowsPersistence: boolean;
  requiresOwnership: boolean;
  requiresTracker: boolean;
  requiresQuarantine: boolean;
}

export const MUTATION_POLICY_CATALOG: Record<MutationPolicyId, MutationPolicyDefinition> = {
  READ_ONLY: {
    id: 'READ_ONLY',
    description: 'No persistence allowed; observability-only',
    allowsPersistence: false,
    requiresOwnership: false,
    requiresTracker: false,
    requiresQuarantine: false,
  },
  GUARDED_MUTATION: {
    id: 'GUARDED_MUTATION',
    description: 'Mutation through a boundary, no mirror dependency',
    allowsPersistence: true,
    requiresOwnership: true,
    requiresTracker: true,
    requiresQuarantine: false,
  },
  MIRROR_MUTATION: {
    id: 'MIRROR_MUTATION',
    description: 'Dual-write to canonical + mirror, requires ownership',
    allowsPersistence: true,
    requiresOwnership: true,
    requiresTracker: true,
    requiresQuarantine: false,
  },
  CANONICAL_MUTATION: {
    id: 'CANONICAL_MUTATION',
    description: 'Mutation in canonical table only via tracker boundary',
    allowsPersistence: true,
    requiresOwnership: true,
    requiresTracker: true,
    requiresQuarantine: false,
  },
  LEGACY_MUTATION: {
    id: 'LEGACY_MUTATION',
    description: 'Legacy path tolerated only under explicit quarantine',
    allowsPersistence: true,
    requiresOwnership: false,
    requiresTracker: false,
    requiresQuarantine: true,
  },
  ATOMIC_CANDIDATE: {
    id: 'ATOMIC_CANDIDATE',
    description: 'Awaiting atomic RPC migration; multi-step + supportsAtomic + not READY',
    allowsPersistence: true,
    requiresOwnership: true,
    requiresTracker: true,
    requiresQuarantine: false,
  },
};

const TRACKER_BOUNDARIES = new Set<BoundaryId>([
  'multiWriteSync',
  'avatarSync',
  'onboardingProgressSync',
  'adminWriteBoundary',
]);

export function resolveMutationPolicy(reg: FlowRegistration): MutationPolicyId {
  const cls = classifyFlowRegistration(reg).classification;
  if (cls === 'LEGACY' || cls === 'UNSAFE') return 'LEGACY_MUTATION';
  const profile = getFlowDriftProfile(reg.flow);
  if (reg.steps.length > 1 && reg.supportsAtomic && reg.readiness !== 'READY') {
    return 'ATOMIC_CANDIDATE';
  }
  if (profile?.depends_on_mirror) return 'MIRROR_MUTATION';
  if (TRACKER_BOUNDARIES.has(reg.boundary)) return 'CANONICAL_MUTATION';
  return 'GUARDED_MUTATION';
}

export interface FlowMutationPolicy {
  flow: FlowId;
  policy: MutationPolicyId;
  ownership: ContactOwner | 'mixed';
  boundary: BoundaryId;
}

export const FLOW_MUTATION_POLICIES: readonly FlowMutationPolicy[] = OPERATION_REGISTRY.map(
  (r) => ({
    flow: r.flow,
    policy: resolveMutationPolicy(r),
    ownership: r.ownership,
    boundary: r.boundary,
  }),
);

export interface MutationPolicyViolation {
  flow: FlowId;
  policy: MutationPolicyId;
  reason: string;
}

export function assertMutationPolicy(): {
  ok: boolean;
  violations: MutationPolicyViolation[];
} {
  const violations: MutationPolicyViolation[] = [];
  for (const reg of OPERATION_REGISTRY) {
    const policy = resolveMutationPolicy(reg);
    const def = MUTATION_POLICY_CATALOG[policy];
    if (def.requiresTracker && !TRACKER_BOUNDARIES.has(reg.boundary)) {
      violations.push({
        flow: reg.flow,
        policy,
        reason: `policy ${policy} requires tracker but boundary is ${reg.boundary}`,
      });
    }
    if (def.requiresOwnership && reg.ownership === 'mixed') {
      const profile = getFlowDriftProfile(reg.flow);
      if (!profile?.depends_on_mirror) {
        violations.push({
          flow: reg.flow,
          policy,
          reason: `policy ${policy} requires ownership and mixed flows need mirror profile`,
        });
      }
    }
    if (def.requiresQuarantine && !isQuarantinedFlow(reg.flow)) {
      violations.push({
        flow: reg.flow,
        policy,
        reason: `policy ${policy} requires explicit quarantine entry`,
      });
    }
  }
  return { ok: violations.length === 0, violations };
}

export function getMutationPolicyForFlow(flow: FlowId): FlowMutationPolicy | undefined {
  return FLOW_MUTATION_POLICIES.find((p) => p.flow === flow);
}
