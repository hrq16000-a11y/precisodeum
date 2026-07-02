/**
 * Fase 1.6.7 — Canonical admin write boundary.
 *
 * Avoid fragmented admin-side updates. Every admin-initiated mutation to
 * `profiles` / `providers` SHOULD pass through this module so we have:
 *   - one place to normalize phone/whatsapp (Fase 1.3)
 *   - one place to coordinate multi-write tracking (Fase 1.6.3)
 *   - one place to emit standardized partial-failure audit logs
 *   - one place to standardize user-facing error messages
 *
 * This boundary is intentionally PERMISSIVE on payload shape and does NOT
 * change RLS, permissions, schema, RPCs, bulk semantics, or approve/reject
 * flows. It is a thin client-side seam preparing the ground for a future
 * server-side `admin_update_user_atomic` RPC.
 *
 * It re-uses:
 *   - `normalizePhoneBR` from validation (Fase 1.3)
 *   - `createSyncTracker` / `logSyncFailure` from multiWriteSync (Fase 1.6.3)
 *   - `STANDARD_PARTIAL_MESSAGE` for consistent UX copy
 *   - Avatar writes still flow through `@/lib/avatarSync` (Fase 1.6.4)
 *   - Contact ownership semantics from `@/lib/contactOwnership` (Fase 1.6.6)
 */

import { supabase } from '@/integrations/supabase/client';
import { logAuditAction } from '@/hooks/useAuditLog';
import { normalizePhoneBR } from '@/lib/validation/phoneNormalization';
import {
  createSyncTracker,
  logSyncFailure,
  showPartialSyncError,
  STANDARD_PARTIAL_MESSAGE,
  type SyncStep,
  type SyncSnapshot,
} from '@/lib/multiWriteSync';

export type AdminWriteTarget = 'profile' | 'provider';

export interface AdminWriteResult {
  ok: boolean;
  error?: { code?: string | null; message?: string } | null;
}

/**
 * Normalize a payload destined for an admin write. Currently only normalizes
 * phone/whatsapp keys. Leaves all other keys untouched. Idempotent.
 *
 * Pure function — never throws.
 */
export function normalizeAdminWritePayload<T extends Record<string, any>>(
  target: AdminWriteTarget,
  payload: T,
): T {
  if (!payload || typeof payload !== 'object') return payload;
  const next: Record<string, any> = { ...payload };
  for (const key of ['phone', 'whatsapp']) {
    const raw = next[key];
    if (typeof raw === 'string' && raw.trim()) {
      const normalized = normalizePhoneBR(raw);
      if (normalized) next[key] = normalized;
    }
  }
  // Keep `target` reserved for future per-table rules (no-op today).
  void target;
  return next as T;
}

interface UpdateAdminProfileOpts {
  userId: string;
  patch: Record<string, any>;
  source: string; // call-site identifier (no PII)
  /** Skip normalization for fields not user-editable (e.g. status/role bulk). */
  skipNormalize?: boolean;
}

/**
 * Canonical admin write to `profiles`.
 * Returns `{ ok, error }`. NEVER throws.
 */
export async function updateAdminProfile(
  opts: UpdateAdminProfileOpts,
): Promise<AdminWriteResult> {
  const payload = opts.skipNormalize
    ? opts.patch
    : normalizeAdminWritePayload('profile', opts.patch);
  try {
    const { error } = await supabase
      .from('profiles')
      .update(payload as any)
      .eq('id', opts.userId);
    if (error) {
      await emitBoundaryFailure({
        source: opts.source,
        target: 'profile',
        snapshot: { profile_updated: false, provider_updated: false, service_created: false, failed_step: 'profile' },
        errorCode: (error as any).code ?? null,
      });
      return { ok: false, error: { code: (error as any).code ?? null, message: error.message } };
    }
    return { ok: true };
  } catch (err: any) {
    await emitBoundaryFailure({
      source: opts.source,
      target: 'profile',
      snapshot: { profile_updated: false, provider_updated: false, service_created: false, failed_step: 'profile' },
      errorCode: err?.code ?? 'exception',
    });
    return { ok: false, error: { code: err?.code ?? 'exception', message: err?.message } };
  }
}

interface UpdateAdminProviderOpts {
  providerId: string;
  patch: Record<string, any>;
  source: string;
  skipNormalize?: boolean;
}

/**
 * Canonical admin write to `providers`.
 * Returns `{ ok, error }`. NEVER throws.
 */
export async function updateAdminProvider(
  opts: UpdateAdminProviderOpts,
): Promise<AdminWriteResult> {
  const payload = opts.skipNormalize
    ? opts.patch
    : normalizeAdminWritePayload('provider', opts.patch);
  try {
    const { error } = await supabase
      .from('providers')
      .update(payload as any)
      .eq('id', opts.providerId);
    if (error) {
      await emitBoundaryFailure({
        source: opts.source,
        target: 'provider',
        snapshot: { profile_updated: false, provider_updated: false, service_created: false, failed_step: 'provider' },
        errorCode: (error as any).code ?? null,
      });
      return { ok: false, error: { code: (error as any).code ?? null, message: error.message } };
    }
    return { ok: true };
  } catch (err: any) {
    await emitBoundaryFailure({
      source: opts.source,
      target: 'provider',
      snapshot: { profile_updated: false, provider_updated: false, service_created: false, failed_step: 'provider' },
      errorCode: err?.code ?? 'exception',
    });
    return { ok: false, error: { code: err?.code ?? 'exception', message: err?.message } };
  }
}

export interface AdminMultiWriteStep {
  /** Logical step id used by the tracker. */
  step: SyncStep;
  /** Async runner; should return `{ ok, error? }`. */
  run: () => Promise<AdminWriteResult>;
}

export interface RunAdminMultiWriteOpts {
  source: string;
  steps: AdminMultiWriteStep[];
  /** Show standard partial-failure toast on first failure. Default true. */
  showToastOnFailure?: boolean;
}

export interface RunAdminMultiWriteResult {
  ok: boolean;
  snapshot: SyncSnapshot;
  errorCode?: string | null;
}

/**
 * Orchestrates multiple admin writes with sync-tracker semantics.
 * On first failure: stops, logs `admin_write_boundary_failed`, shows the
 * standard partial-sync toast (no raw SQL), returns ok=false.
 *
 * This does NOT create a real transaction — it only prevents "false success"
 * UX states and gives us observability until the future atomic RPC ships.
 */
export async function runAdminMultiWrite(
  opts: RunAdminMultiWriteOpts,
): Promise<RunAdminMultiWriteResult> {
  const tracker = createSyncTracker();
  let firstErrorCode: string | null | undefined = null;
  for (const step of opts.steps) {
    const res = await step.run();
    tracker.mark(step.step, res.ok);
    if (!res.ok) {
      firstErrorCode = res.error?.code ?? null;
      break;
    }
  }
  const snapshot = tracker.snapshot();
  if (snapshot.failed_step) {
    await emitBoundaryFailure({
      source: opts.source,
      target: snapshot.failed_step === 'provider' || snapshot.failed_step === 'status' ? 'provider' : 'profile',
      snapshot,
      errorCode: firstErrorCode ?? null,
    });
    if (opts.showToastOnFailure !== false) showPartialSyncError();
    return { ok: false, snapshot, errorCode: firstErrorCode ?? null };
  }
  return { ok: true, snapshot };
}

interface EmitBoundaryFailureOpts {
  source: string;
  target: AdminWriteTarget;
  snapshot: SyncSnapshot;
  errorCode?: string | null;
}

async function emitBoundaryFailure(opts: EmitBoundaryFailureOpts): Promise<void> {
  // 1) Specialized boundary action (preferred consumer for dashboards).
  try {
    await logAuditAction({
      action: 'admin_write_boundary_failed' as any,
      resource_type: 'admin_write_boundary',
      details: {
        source: opts.source,
        target: opts.target,
        ...opts.snapshot,
        error_code: opts.errorCode ?? null,
      },
    });
  } catch { /* fail-soft */ }
  // 2) Mirror into the multiWriteSync channel for unified queries.
  await logSyncFailure({
    action: 'phase4_sync_failed' as any, // reuse generic channel; no schema change
    source: `admin:${opts.source}`,
    snapshot: opts.snapshot,
    errorCode: opts.errorCode ?? null,
    extra: { target: opts.target },
  });
}

export { STANDARD_PARTIAL_MESSAGE };
