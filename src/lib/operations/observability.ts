/**
 * Fase 1.6.8 — Pre-atomic operation boundary.
 * Prepared for future RPC migration.
 *
 * Emits `operation_build_failed` ONLY when a builder rejects the input
 * (impossible dependency / inconsistent ownership / impossible payload).
 * No PII — only `source`, `code`, `reason` and small boolean signals.
 */

import { logAuditAction } from '@/hooks/useAuditLog';
import type { OperationBuildFailure } from './types';

export async function logOperationBuildFailure(
  source: string,
  fail: OperationBuildFailure,
  extra?: Record<string, unknown>,
): Promise<void> {
  try {
    await logAuditAction({
      action: 'operation_build_failed' as any,
      resource_type: 'pre_atomic_operation',
      details: {
        source,
        code: fail.code,
        reason: fail.reason,
        ...(extra || {}),
      },
    });
  } catch {
    /* fail-soft */
  }
}
