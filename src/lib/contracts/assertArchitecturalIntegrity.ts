/**
 * Fase 1.7.5 — Architectural Integrity Assertion (PURE).
 *
 * Falha (retorna ok=false + violations) se:
 *  - flow sem contract
 *  - READY sem guarantees mínimas (overall < STRONG)
 *  - dual-write sem mutation policy compatível
 *  - HIGH risk (any invariant CRITICAL/HIGH triggered) sem observability
 *  - circular dependency crítica
 *  - mutation fora policy
 *  - boundary órfã
 *  - mirror sem telemetry contract
 *
 * Determinístico. Sem persistência. Nunca lança.
 */

import {
  OPERATION_REGISTRY,
  type FlowId,
} from '@/lib/operations/operationRegistry';
import {
  assertContractCoverage,
  BOUNDARY_CONTRACTS,
  getFlowContract,
  getMirrorContract,
  getTelemetryContract,
} from './contractRegistry';
import { buildDependencyGraph, detectCircularDependencies, detectMissingDependencies } from './dependencyGraph';
import { calculateGuaranteeLevel } from './guarantees';
import { assertAllInvariants } from './invariantRegistry';
import { assertMutationPolicy, getMutationPolicyForFlow } from './mutationPolicies';

export type ArchitecturalIntegrityCode =
  | 'flow_missing_contract'
  | 'ready_flow_below_minimum_guarantees'
  | 'dual_write_missing_mutation_policy'
  | 'high_risk_missing_observability'
  | 'circular_dependency_detected'
  | 'mutation_outside_policy'
  | 'boundary_orphan'
  | 'mirror_missing_telemetry';

export interface ArchitecturalIntegrityViolation {
  code: ArchitecturalIntegrityCode;
  flow?: FlowId;
  reason: string;
}

export interface ArchitecturalIntegrityResult {
  ok: boolean;
  violations: ArchitecturalIntegrityViolation[];
}

export function assertArchitecturalIntegrity(): ArchitecturalIntegrityResult {
  const violations: ArchitecturalIntegrityViolation[] = [];

  // 1. Contract coverage
  const coverage = assertContractCoverage();
  if (!coverage.ok) {
    for (const f of coverage.flowsMissingContract) {
      violations.push({
        code: 'flow_missing_contract',
        flow: f,
        reason: `flow ${f} has no FlowContract`,
      });
    }
    for (const b of coverage.boundariesMissingContract) {
      violations.push({
        code: 'boundary_orphan',
        reason: `boundary ${b} has no BoundaryContract`,
      });
    }
  }

  // 2. READY flow guarantees ≥ STRONG (overall)
  for (const r of OPERATION_REGISTRY) {
    if (r.readiness !== 'READY') continue;
    const g = calculateGuaranteeLevel(r.flow);
    if (!g) continue;
    if (g.overall === 'NONE' || g.overall === 'PARTIAL') {
      violations.push({
        code: 'ready_flow_below_minimum_guarantees',
        flow: r.flow,
        reason: `READY flow ${r.flow} overall guarantee=${g.overall}`,
      });
    }
  }

  // 3. Dual-write → mutation policy compatível
  const mpResult = assertMutationPolicy();
  if (!mpResult.ok) {
    for (const v of mpResult.violations) {
      violations.push({
        code: 'mutation_outside_policy',
        flow: v.flow,
        reason: v.reason,
      });
    }
  }
  for (const r of OPERATION_REGISTRY) {
    if (r.ownership !== 'mixed') continue;
    const policy = getMutationPolicyForFlow(r.flow);
    if (!policy) {
      violations.push({
        code: 'dual_write_missing_mutation_policy',
        flow: r.flow,
        reason: `mixed-ownership flow ${r.flow} has no mutation policy`,
      });
      continue;
    }
    if (
      policy.policy !== 'MIRROR_MUTATION' &&
      policy.policy !== 'ATOMIC_CANDIDATE' &&
      policy.policy !== 'CANONICAL_MUTATION'
    ) {
      violations.push({
        code: 'dual_write_missing_mutation_policy',
        flow: r.flow,
        reason: `mixed-ownership flow ${r.flow} uses policy ${policy.policy}`,
      });
    }
  }

  // 4. HIGH risk invariants → observability obrigatória
  const invs = assertAllInvariants();
  for (const v of invs.violations) {
    if (v.severity !== 'high' && v.severity !== 'critical') continue;
    const fc = getFlowContract(v.flow);
    if (!fc || fc.requiredObservability.length === 0) {
      violations.push({
        code: 'high_risk_missing_observability',
        flow: v.flow,
        reason: `flow ${v.flow} hit ${v.severity} invariant ${v.invariantId} without observability`,
      });
    }
  }

  // 5. Circular dependency
  const graph = buildDependencyGraph();
  const cycles = detectCircularDependencies(graph);
  for (const cycle of cycles) {
    violations.push({
      code: 'circular_dependency_detected',
      reason: `cycle: ${cycle.join(' -> ')}`,
    });
  }

  // Missing deps → boundary órfã se for o caso
  const missing = detectMissingDependencies(graph);
  for (const m of missing) {
    if (m.missing === 'boundary') {
      violations.push({
        code: 'boundary_orphan',
        flow: m.flow,
        reason: m.reason,
      });
    }
  }

  // 6. Mirror sem telemetry contract
  for (const r of OPERATION_REGISTRY) {
    const mc = getMirrorContract(r.flow);
    if (!mc?.hasMirror) continue;
    const tc = getTelemetryContract(r.flow);
    if (!tc) {
      violations.push({
        code: 'mirror_missing_telemetry',
        flow: r.flow,
        reason: `mirror flow ${r.flow} has no telemetry contract`,
      });
    }
  }

  // Boundaries declared in BOUNDARY_CONTRACTS that have zero flows would be orphan,
  // but the registry derives boundaries from flows, so the check is automatically safe.
  for (const bc of BOUNDARY_CONTRACTS) {
    if (bc.flows.length === 0) {
      violations.push({
        code: 'boundary_orphan',
        reason: `boundary ${bc.boundary} declared without flows`,
      });
    }
  }

  return { ok: violations.length === 0, violations };
}
