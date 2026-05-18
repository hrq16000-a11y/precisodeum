/**
 * Fase 1.7.5 — Architectural Invariant Registry (PURE, READ-ONLY).
 *
 * Formaliza invariantes estruturais que NÃO podem regredir sem violar a
 * arquitetura consolidada nas fases 1.5 → 1.7.4. Cada invariante é uma
 * função determinística sobre os registries existentes.
 *
 * Determinístico. Sem Supabase, hooks, timers, fetch, window/localStorage.
 */

import {
  OPERATION_REGISTRY,
  type FlowId,
  type FlowRegistration,
  type Readiness,
} from '@/lib/operations/operationRegistry';
import { FLOW_DRIFT_PROFILES, getFlowDriftProfile } from '@/lib/drift/driftRegistry';
import { isQuarantinedFlow } from '@/lib/drift/quarantineRegistry';
import { classifyFlowRegistration } from '@/lib/drift/writeClassification';

export type InvariantSeverity = 'low' | 'medium' | 'high' | 'critical';

export type InvariantCategory =
  | 'ownership'
  | 'boundary'
  | 'drift'
  | 'telemetry'
  | 'readiness'
  | 'execution'
  | 'mirror'
  | 'onboarding'
  | 'admin'
  | 'atomicity';

export interface ArchitecturalInvariant {
  id: string;
  category: InvariantCategory;
  severity: InvariantSeverity;
  description: string;
  /** Executa puro. Retorna lista de flows que violam a invariante. */
  evaluate: () => FlowId[];
}

export interface InvariantViolation {
  invariantId: string;
  category: InvariantCategory;
  severity: InvariantSeverity;
  flow: FlowId;
  description: string;
}

export interface InvariantEvaluationResult {
  ok: boolean;
  violations: InvariantViolation[];
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const TRACKER_BOUNDARIES = new Set([
  'multiWriteSync',
  'avatarSync',
  'onboardingProgressSync',
  'adminWriteBoundary',
]);

function regs(): readonly FlowRegistration[] {
  return OPERATION_REGISTRY;
}

// ---------------------------------------------------------------------------
// Invariantes oficiais
// ---------------------------------------------------------------------------

export const ARCHITECTURAL_INVARIANTS: readonly ArchitecturalInvariant[] = [
  {
    id: 'ready_flow_must_have_tracker',
    category: 'readiness',
    severity: 'high',
    description: 'READY flow MUST have tracker (canonical boundary)',
    evaluate: () =>
      regs()
        .filter((r) => r.readiness === 'READY' && !TRACKER_BOUNDARIES.has(r.boundary))
        .map((r) => r.flow),
  },
  {
    id: 'dual_write_must_have_ownership',
    category: 'ownership',
    severity: 'critical',
    description: 'dual-write MUST have ownership resolved (mixed ⇒ mirror profile required)',
    evaluate: () => {
      const out: FlowId[] = [];
      for (const r of regs()) {
        const profile = getFlowDriftProfile(r.flow);
        if (r.ownership === 'mixed' && !profile?.depends_on_mirror) out.push(r.flow);
      }
      return out;
    },
  },
  {
    id: 'atomic_candidate_must_have_builder',
    category: 'atomicity',
    severity: 'high',
    description: 'atomic candidate (multi-step + supportsAtomic) MUST have builder',
    evaluate: () =>
      regs()
        .filter((r) => r.steps.length > 1 && r.supportsAtomic && r.builder === null)
        .map((r) => r.flow),
  },
  {
    id: 'legacy_flow_must_be_quarantined',
    category: 'boundary',
    severity: 'high',
    description: 'LEGACY flow MUST be quarantined explicitly',
    evaluate: () => {
      const out: FlowId[] = [];
      for (const r of regs()) {
        const cls = classifyFlowRegistration(r).classification;
        if (cls === 'LEGACY' && !isQuarantinedFlow(r.flow)) out.push(r.flow);
      }
      return out;
    },
  },
  {
    id: 'mirror_dependency_must_be_observable',
    category: 'mirror',
    severity: 'medium',
    description: 'mirror dependency MUST be observable (tracker boundary)',
    evaluate: () => {
      const out: FlowId[] = [];
      for (const r of regs()) {
        const profile = getFlowDriftProfile(r.flow);
        if (profile?.depends_on_mirror && !TRACKER_BOUNDARIES.has(r.boundary)) {
          out.push(r.flow);
        }
      }
      return out;
    },
  },
  {
    id: 'finalize_onboarding_must_use_canonical_entrypoint',
    category: 'onboarding',
    severity: 'critical',
    description: 'finalize onboarding MUST use canonical entrypoint (requiresFinalize ⇒ tracker)',
    evaluate: () =>
      regs()
        .filter((r) => r.requiresFinalize && !TRACKER_BOUNDARIES.has(r.boundary))
        .map((r) => r.flow),
  },
  {
    id: 'unsafe_path_must_not_bypass_registry',
    category: 'boundary',
    severity: 'critical',
    description: 'unsafe path MUST NOT bypass registry (inline_call_site forbidden)',
    evaluate: () => regs().filter((r) => r.boundary === 'inline_call_site').map((r) => r.flow),
  },
  {
    id: 'high_risk_flow_must_have_boundary',
    category: 'boundary',
    severity: 'critical',
    description: 'HIGH risk flow (multi-step + non-READY) MUST have tracker boundary',
    evaluate: () =>
      regs()
        .filter(
          (r) =>
            r.steps.length > 1 && r.readiness !== 'READY' && !TRACKER_BOUNDARIES.has(r.boundary),
        )
        .map((r) => r.flow),
  },
  {
    id: 'provider_contact_must_respect_ownership',
    category: 'ownership',
    severity: 'critical',
    description: 'provider contact MUST respect ownership 1.6.6 (provider flow ⇒ ownership=provider|mixed)',
    evaluate: () =>
      regs()
        .filter((r) => r.dependencies.some((d) => d.startsWith('providers.')) && r.ownership === 'profile')
        .map((r) => r.flow),
  },
  {
    id: 'drift_detector_must_cover_all_flows',
    category: 'drift',
    severity: 'high',
    description: 'drift detector MUST cover all flows (FLOW_DRIFT_PROFILES coverage)',
    evaluate: () => {
      const covered = new Set(FLOW_DRIFT_PROFILES.map((p) => p.flow));
      return regs().filter((r) => !covered.has(r.flow)).map((r) => r.flow);
    },
  },
] as const;

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

export function assertInvariant(id: string): InvariantEvaluationResult {
  const inv = ARCHITECTURAL_INVARIANTS.find((i) => i.id === id);
  if (!inv) {
    return { ok: false, violations: [] };
  }
  const flows = inv.evaluate();
  const violations = flows.map<InvariantViolation>((flow) => ({
    invariantId: inv.id,
    category: inv.category,
    severity: inv.severity,
    flow,
    description: inv.description,
  }));
  return { ok: violations.length === 0, violations };
}

export function assertAllInvariants(): InvariantEvaluationResult {
  const violations: InvariantViolation[] = [];
  for (const inv of ARCHITECTURAL_INVARIANTS) {
    const flows = inv.evaluate();
    for (const flow of flows) {
      violations.push({
        invariantId: inv.id,
        category: inv.category,
        severity: inv.severity,
        flow,
        description: inv.description,
      });
    }
  }
  return { ok: violations.length === 0, violations };
}

export function getInvariantsByCategory(cat: InvariantCategory): ArchitecturalInvariant[] {
  return ARCHITECTURAL_INVARIANTS.filter((i) => i.category === cat);
}

export function getInvariantById(id: string): ArchitecturalInvariant | undefined {
  return ARCHITECTURAL_INVARIANTS.find((i) => i.id === id);
}

// Re-export Readiness for downstream contract typing convenience.
export type { Readiness };
