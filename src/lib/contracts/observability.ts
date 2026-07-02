/**
 * Fase 1.7.5 — Architectural contracts observability (PII-free, fail-soft).
 *
 * Eventos:
 *  - architectural_invariant_failed
 *  - contract_coverage_failed
 *  - guarantee_violation_detected
 *  - dependency_instability_detected
 *
 * Payload restrito a: flow, invariant, contract, guarantee, dependency,
 * classification, readiness, severity. SEM PII.
 */

import { logAuditAction } from '@/hooks/useAuditLog';
import type { InvariantViolation } from './invariantRegistry';
import type { ContractCoverageReport } from './contractTypes';
import type { GuaranteeViolation } from './guarantees';
import type { MissingDependency, OvercoupledFlow } from './dependencyGraph';

export interface ContractsAuditContext {
  source: string;
}

export async function logArchitecturalInvariantFailed(
  ctx: ContractsAuditContext,
  violation: InvariantViolation,
): Promise<void> {
  try {
    await logAuditAction({
      action: 'architectural_invariant_failed' as any,
      resource_type: 'architectural_contract',
      details: {
        source: ctx.source,
        invariant: violation.invariantId,
        category: violation.category,
        severity: violation.severity,
        flow: violation.flow,
      },
    });
  } catch {
    /* fail-soft */
  }
}

export async function logContractCoverageFailed(
  ctx: ContractsAuditContext,
  report: ContractCoverageReport,
): Promise<void> {
  if (report.ok) return;
  try {
    await logAuditAction({
      action: 'contract_coverage_failed' as any,
      resource_type: 'architectural_contract',
      details: {
        source: ctx.source,
        total_flows: report.totalFlows,
        flows_with_contract: report.flowsWithContract,
        boundaries_with_contract: report.boundariesWithContract,
        flows_missing: report.flowsMissingContract,
        boundaries_missing: report.boundariesMissingContract,
      },
    });
  } catch {
    /* fail-soft */
  }
}

export async function logGuaranteeViolationDetected(
  ctx: ContractsAuditContext,
  violation: GuaranteeViolation,
): Promise<void> {
  try {
    await logAuditAction({
      action: 'guarantee_violation_detected' as any,
      resource_type: 'architectural_contract',
      details: {
        source: ctx.source,
        flow: violation.flow,
        guarantee: violation.guarantee,
        level: violation.level,
        reason: violation.reason,
      },
    });
  } catch {
    /* fail-soft */
  }
}

export async function logDependencyInstabilityDetected(
  ctx: ContractsAuditContext,
  payload: {
    missing?: MissingDependency[];
    overcoupled?: OvercoupledFlow[];
    cycles?: string[][];
  },
): Promise<void> {
  try {
    await logAuditAction({
      action: 'dependency_instability_detected' as any,
      resource_type: 'architectural_contract',
      details: {
        source: ctx.source,
        missing_count: payload.missing?.length ?? 0,
        overcoupled_count: payload.overcoupled?.length ?? 0,
        cycles_count: payload.cycles?.length ?? 0,
        missing: payload.missing,
        overcoupled: payload.overcoupled,
        cycles: payload.cycles,
      },
    });
  } catch {
    /* fail-soft */
  }
}
