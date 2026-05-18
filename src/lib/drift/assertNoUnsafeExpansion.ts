/**
 * Fase 1.7.3 — Regression guard (PURE).
 *
 * Falha explicitamente se a arquitetura regredir:
 *  - flow registrado sem boundary canônica
 *  - dual-write sem ownership resolvido
 *  - flow READY sem tracker
 *  - unsafe path NÃO quarentenado
 *  - flow fora do registry (passado via paramêtro)
 *
 * Função PURA. Não emite telemetria. Não lê filesystem. Caller decide
 * o que fazer com o resultado (test assertion, observability, dashboard).
 */

import {
  OPERATION_REGISTRY,
  type FlowId,
  type FlowRegistration,
} from '@/lib/operations/operationRegistry';
import {
  detectUnsafeWriteExpansion,
  isQuarantinedFlow,
} from './quarantineRegistry';
import {
  classifyFlowRegistration,
} from './writeClassification';

export type UnsafeExpansionCode =
  | 'flow_without_boundary'
  | 'dual_write_without_ownership'
  | 'ready_flow_without_tracker'
  | 'unsafe_path_not_quarantined'
  | 'flow_outside_registry';

export interface UnsafeExpansionViolation {
  code: UnsafeExpansionCode;
  flow?: FlowId;
  file?: string;
  reason: string;
}

export interface AssertNoUnsafeExpansionInput {
  /** Hits do detectUnsafeWrites (estático). Opcional. */
  unsafeHits?: ReadonlyArray<{
    file: string;
    line: number;
    table: string | null;
    severity: 'SAFE' | 'LEGACY' | 'UNSAFE' | 'UNKNOWN';
    reason: string;
  }>;
  /** Flows externos que deveriam estar no registry mas não estão. */
  externalFlows?: ReadonlyArray<string>;
}

export interface AssertNoUnsafeExpansionResult {
  ok: boolean;
  violations: UnsafeExpansionViolation[];
}

const CANONICAL_BOUNDARIES = new Set([
  'multiWriteSync',
  'avatarSync',
  'onboardingProgressSync',
  'adminWriteBoundary',
]);

function inspectFlow(reg: FlowRegistration): UnsafeExpansionViolation[] {
  const violations: UnsafeExpansionViolation[] = [];

  if (!CANONICAL_BOUNDARIES.has(reg.boundary) && !isQuarantinedFlow(reg.flow)) {
    violations.push({
      code: 'flow_without_boundary',
      flow: reg.flow,
      reason: `boundary=${reg.boundary} não-canônica e flow não está quarentenado`,
    });
  }

  const isDualWrite = reg.steps.length > 1 || reg.ownership === 'mixed';
  if (isDualWrite && reg.ownership !== 'mixed' && reg.ownership !== 'profile' && reg.ownership !== 'provider') {
    violations.push({
      code: 'dual_write_without_ownership',
      flow: reg.flow,
      reason: 'flow multi-step sem ownership resolvido',
    });
  }

  if (reg.readiness === 'READY') {
    const cls = classifyFlowRegistration(reg);
    if (cls.reason === 'flow_boundary_without_tracker' || cls.classification === 'UNSAFE') {
      violations.push({
        code: 'ready_flow_without_tracker',
        flow: reg.flow,
        reason: `READY flow classificado como ${cls.classification} (${cls.reason})`,
      });
    }
  }

  return violations;
}

export function assertNoUnsafeExpansion(
  input: AssertNoUnsafeExpansionInput = {},
): AssertNoUnsafeExpansionResult {
  const violations: UnsafeExpansionViolation[] = [];

  for (const reg of OPERATION_REGISTRY) {
    violations.push(...inspectFlow(reg));
  }

  if (input.unsafeHits && input.unsafeHits.length > 0) {
    const expansions = detectUnsafeWriteExpansion(input.unsafeHits);
    for (const e of expansions) {
      violations.push({
        code: 'unsafe_path_not_quarantined',
        file: e.file,
        reason: `${e.reason} @ ${e.file}:${e.line} (table=${e.table ?? 'unknown'})`,
      });
    }
  }

  if (input.externalFlows && input.externalFlows.length > 0) {
    const known = new Set(OPERATION_REGISTRY.map((r) => r.flow as string));
    for (const f of input.externalFlows) {
      if (!known.has(f)) {
        violations.push({
          code: 'flow_outside_registry',
          reason: `flow "${f}" não está em OPERATION_REGISTRY`,
        });
      }
    }
  }

  return { ok: violations.length === 0, violations };
}
