/**
 * Fase 1.6.4 — Canonical avatar write boundary.
 *
 * SINGLE SOURCE OF TRUTH for writes to:
 *   - profiles.avatar_url
 *   - providers.photo_url
 *
 * Avoid direct `supabase.from('profiles').update({ avatar_url })` or
 * `providers.update({ photo_url })` calls outside this module — use
 * `setUserAvatar()` instead so sync/observability stays consistent.
 *
 * Out of scope (intentionally NOT touched):
 *   - upload UX / crop / storage bucket choice
 *   - read priority (handled by `profileResolvers` from Fase 1.5)
 *   - providerDisplay fallback chain
 *   - social sync source decision (caller decides; we just persist)
 *
 * Sync model: leverages `createSyncTracker` from Fase 1.6.3 so that any
 * partial failure (profile OK + provider FAIL or vice-versa) is surfaced
 * via `avatar_sync_failed` audit log + the standard partial message.
 */

import { supabase } from '@/integrations/supabase/client';
import {
  createSyncTracker,
  logSyncFailure,
  showPartialSyncError,
  STANDARD_PARTIAL_MESSAGE,
} from '@/lib/multiWriteSync';

export type AvatarSyncSource =
  | 'avatar_upload_component'
  | 'dashboard_profile_page'
  | 'admin_user_detail_sheet'
  | 'onboarding_phase4_avatar'
  | 'onboarding_v2_shell'
  | 'social_avatar_oneshot'
  | 'other';

export interface SetUserAvatarOpts {
  /** Target profile/user id (profiles.id === auth.users.id). */
  userId: string;
  /** New public URL to persist. */
  url: string;
  /** Call-site identifier (no PII). */
  source: AvatarSyncSource;
  /**
   * When true (default) the helper also tries to upsert `providers.photo_url`
   * if the user has a provider row. When false, only profiles is touched.
   */
  syncProvider?: boolean;
  /**
   * Override automatic provider detection (useful when caller already knows
   * the providerId — saves one round-trip).
   */
  providerId?: string | null;
  /**
   * When true, suppress the toast on partial failure (caller will handle UI).
   * Audit log is still emitted.
   */
  silent?: boolean;
}

export interface SetUserAvatarResult {
  ok: boolean;
  profileUpdated: boolean;
  providerUpdated: boolean;
  failedStep: 'profile' | 'provider' | null;
  errorMessage?: string;
}

/**
 * Lightweight provider lookup. Returns null when user has no provider row,
 * the row doesn't exist yet, or RLS hides it.
 */
async function lookupProviderId(userId: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('providers')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    return (data?.id as string) || null;
  } catch {
    return null;
  }
}

/** Public helper for callers that only need to know WHERE writes will go. */
export async function resolveAvatarWriteTargets(userId: string): Promise<{
  profile: true;
  provider: boolean;
  providerId: string | null;
}> {
  const providerId = await lookupProviderId(userId);
  return { profile: true, provider: !!providerId, providerId };
}

/** Update providers.photo_url only. Internal — prefer setUserAvatar. */
export async function syncProviderPhoto(providerId: string, url: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('providers')
      .update({ photo_url: url })
      .eq('id', providerId);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Canonical avatar write boundary.
 *
 * Always tries to update `profiles.avatar_url` first; if the user has a
 * provider row (and `syncProvider !== false`) it also updates
 * `providers.photo_url`. Partial failures are tracked + audited.
 */
export async function setUserAvatar(opts: SetUserAvatarOpts): Promise<SetUserAvatarResult> {
  const { userId, url, source, syncProvider = true, silent = false } = opts;
  const tracker = createSyncTracker();
  let errorMessage: string | undefined;

  // 1) profiles.avatar_url
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: url })
      .eq('id', userId);
    if (error) {
      tracker.mark('profile', false);
      errorMessage = error.message;
    } else {
      tracker.mark('profile', true);
    }
  } catch (e: any) {
    tracker.mark('profile', false);
    errorMessage = e?.message;
  }

  // 2) providers.photo_url (best-effort, only if needed)
  if (syncProvider) {
    const providerId = opts.providerId ?? (await lookupProviderId(userId));
    if (providerId) {
      const ok = await syncProviderPhoto(providerId, url);
      tracker.mark('provider', ok);
    }
  }

  const snap = tracker.snapshot();
  // failed_step from tracker is typed broadly — narrow to avatar domain
  const failedStep: 'profile' | 'provider' | null =
    snap.failed_step === 'profile' || snap.failed_step === 'avatar'
      ? 'profile'
      : snap.failed_step === 'provider' || snap.failed_step === 'status'
      ? 'provider'
      : null;

  if (failedStep) {
    await logSyncFailure({
      action: 'avatar_sync_failed' as any, // registered in useAuditLog AuditAction
      source,
      snapshot: snap,
      errorCode: errorMessage ?? null,
    });
    if (!silent) showPartialSyncError();
  }

  return {
    ok: !failedStep,
    profileUpdated: snap.profile_updated,
    providerUpdated: snap.provider_updated,
    failedStep,
    errorMessage: failedStep ? errorMessage ?? STANDARD_PARTIAL_MESSAGE : undefined,
  };
}
