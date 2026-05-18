/**
 * Fase 1.6.8 — Pre-atomic operation boundary.
 * Prepared for future RPC migration.
 *
 * Standardized shape returned by every operation builder. Builders are PURE:
 * they receive plain inputs, derive payloads + side-effect requirements, and
 * never touch supabase / DOM. Persistence stays in the existing call-sites
 * (boundaries already shipped in 1.6.1–1.6.7).
 *
 * When we migrate to an atomic server-side RPC, builders become the request
 * body and call-sites swap their execution branch — without changing inputs,
 * outputs, observability or ownership semantics.
 */

import type { ContactOwner, ProfileType } from '@/lib/contactOwnership';

export type OperationStep =
  | 'profile'
  | 'provider'
  | 'service'
  | 'avatar'
  | 'finalize'
  | 'profile_type';

export interface PreAtomicOperation {
  /** call-site identifier (no PII) */
  source: string;
  /** patch destined to public.profiles (null = skip) */
  profilePatch: Record<string, unknown> | null;
  /** patch destined to public.providers (null = skip) */
  providerPatch: Record<string, unknown> | null;
  /** payload destined to public.services (null = skip) */
  servicePayload: Record<string, unknown> | null;
  /** whether `finalizeOnboarding` (or equivalent) MUST run as part of the op */
  requiresFinalize: boolean;
  /** whether avatar boundary MUST be touched */
  requiresAvatarSync: boolean;
  /** ownership resolution for contact fields (1.6.6) */
  ownership: ContactOwner;
  /** ordered steps the future RPC will execute */
  steps: OperationStep[];
  /** keys this operation depends on existing (for future server pre-flight) */
  dependencies: string[];
}

export interface OperationBuildSuccess {
  ok: true;
  operation: PreAtomicOperation;
}

export interface OperationBuildFailure {
  ok: false;
  code: string;
  /** short, PII-free reason (e.g. "missing_user_id") */
  reason: string;
  /** partial op for debugging; never persist */
  partial?: Partial<PreAtomicOperation>;
}

export type OperationBuildResult = OperationBuildSuccess | OperationBuildFailure;

/** Convenience helper for builders. */
export function buildOk(operation: PreAtomicOperation): OperationBuildSuccess {
  return { ok: true, operation };
}

export function buildFail(
  code: string,
  reason: string,
  partial?: Partial<PreAtomicOperation>,
): OperationBuildFailure {
  return { ok: false, code, reason, partial };
}

export type { ContactOwner, ProfileType };
