/**
 * Fase 1.7.3 — Legacy isolation observability (PII-free).
 *
 * Emite eventos read-only:
 *  - write_path_quarantined
 *  - unsafe_expansion_detected
 *  - architecture_score_generated
 *
 * Payload restrito a: flow, classification, risk, score, coverage,
 * readiness, boundary_present, tracker_present.
 *
 * PROIBIDO: email, phone, whatsapp, city, address, cpf/cnpj, nome, URL.
 */

import { logAuditAction } from '@/hooks/useAuditLog';
import type { ArchitectureScore } from './architectureScore';
import type {
  QuarantinedWrite,
  UnsafeExpansion,
} from './quarantineRegistry';
import type { WriteClassification } from './writeClassification';
import type { FlowId } from '@/lib/operations/operationRegistry';

export interface IsolationAuditContext {
  source: string;
}

export async function logWritePathQuarantined(
  ctx: IsolationAuditContext,
  q: QuarantinedWrite,
): Promise<void> {
  try {
    await logAuditAction({
      action: 'write_path_quarantined' as any,
      resource_type: 'write_path',
      details: {
        source: ctx.source,
        quarantine_id: q.id,
        category: q.category,
        risk: q.risk,
        flow: q.flow ?? null,
        allowed_until_atomic_migration: q.allowedUntilAtomicMigration,
      },
    });
  } catch {
    /* fail-soft */
  }
}

export async function logUnsafeExpansionDetected(
  ctx: IsolationAuditContext,
  expansion: UnsafeExpansion,
): Promise<void> {
  try {
    await logAuditAction({
      action: 'unsafe_expansion_detected' as any,
      resource_type: 'write_path',
      details: {
        source: ctx.source,
        reason: expansion.reason,
        table: expansion.table ?? null,
        // file/line são metadados estruturais (não-PII), úteis para auditoria.
        file: expansion.file,
        line: expansion.line,
      },
    });
  } catch {
    /* fail-soft */
  }
}

export async function logArchitectureScoreGenerated(
  ctx: IsolationAuditContext,
  score: ArchitectureScore,
): Promise<void> {
  try {
    await logAuditAction({
      action: 'architecture_score_generated' as any,
      resource_type: 'architecture_score',
      details: {
        source: ctx.source,
        score: score.score,
        grade: score.grade,
        total_flows: score.totalFlows,
        boundary_coverage_pct: score.coverage.boundaryCoveragePct,
        tracker_coverage_pct: score.coverage.trackerCoveragePct,
        ownership_coverage_pct: score.coverage.ownershipCoveragePct,
        ready_flows_pct: score.coverage.readyFlowsPct,
        atomic_readiness_pct: score.coverage.atomicReadinessPct,
        legacy_pct: score.coverage.legacyPct,
        unsafe_pct: score.coverage.unsafePct,
        classification: score.classification,
      },
    });
  } catch {
    /* fail-soft */
  }
}

/**
 * Helper para emitir classification-level event sem PII.
 * Útil para auditoria por flow individual.
 */
export async function logFlowClassification(
  ctx: IsolationAuditContext,
  flow: FlowId,
  classification: WriteClassification,
  reason: string,
  signals: { boundary_present: boolean; tracker_present: boolean; readiness: string },
): Promise<void> {
  try {
    await logAuditAction({
      action: 'architecture_score_generated' as any,
      resource_type: 'write_path',
      details: {
        source: ctx.source,
        flow,
        classification,
        reason,
        ...signals,
      },
    });
  } catch {
    /* fail-soft */
  }
}
