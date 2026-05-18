/**
 * Canonical onboarding_progress write boundary (Fase 1.6.5).
 *
 * Avoid direct JSONB overwrite writes against `providers.onboarding_progress`.
 * Todos os call-sites do client devem usar `setOnboardingProgress()` para
 * preservar chaves existentes e evitar overwrite silencioso entre abas/fluxos.
 *
 * Esta camada NÃO altera schema, RLS, RPC ou shape do JSONB — apenas
 * centraliza o merge defensivo e a observabilidade. Persistência real
 * continua via `supabase.from('providers').update({ onboarding_progress })`.
 *
 * Futuramente esta boundary será trocada por RPC atômica server-side sem
 * impactar os call-sites.
 */

import { supabase } from '@/integrations/supabase/client';
import {
  createSyncTracker,
  logSyncFailure,
  showPartialSyncError,
  type SyncTracker,
} from '@/lib/multiWriteSync';

export type OnboardingProgressRecord = Record<string, unknown>;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Merge profundo defensivo: ignora `undefined`, preserva chaves existentes,
 * mescla nested objects. Arrays/primitivos no patch substituem o valor base.
 */
export function safeProgressMerge(
  base: OnboardingProgressRecord | null | undefined,
  next: OnboardingProgressRecord | null | undefined,
): OnboardingProgressRecord {
  const out: OnboardingProgressRecord = { ...(base || {}) };
  if (!next) return out;
  for (const [k, v] of Object.entries(next)) {
    if (v === undefined) continue; // nunca apaga via undefined
    if (isPlainObject(v) && isPlainObject(out[k])) {
      out[k] = safeProgressMerge(
        out[k] as OnboardingProgressRecord,
        v as OnboardingProgressRecord,
      );
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Alias semântico — usado por call-sites que já têm o `current` em mãos. */
export const mergeOnboardingProgress = safeProgressMerge;

export interface SetOnboardingProgressOptions {
  /** Identificador do call-site para audit (sem PII). */
  source: string;
  /** Snapshot atual conhecido pelo caller (evita SELECT extra). */
  currentProgress?: OnboardingProgressRecord | null;
  /** Tracker externo (quando faz parte de multi-write). */
  tracker?: SyncTracker;
  /** Se true, mostra toast amigável em falha. Default: false (silencioso). */
  showToastOnError?: boolean;
}

export interface SetOnboardingProgressResult {
  ok: boolean;
  merged: OnboardingProgressRecord;
  noop: boolean;
  errorCode?: string | null;
}

/**
 * Boundary única para writes de `providers.onboarding_progress`.
 *
 * - Faz merge defensivo com o estado atual (do caller ou via SELECT).
 * - No-op quando o patch não muda nada (evita writes inúteis + loops).
 * - Audit log fail-soft em caso de erro (sem PII).
 * - Integra com `createSyncTracker` quando informado.
 */
export async function setOnboardingProgress(
  providerId: string | null | undefined,
  patch: OnboardingProgressRecord,
  options: SetOnboardingProgressOptions,
): Promise<SetOnboardingProgressResult> {
  if (!providerId) {
    return { ok: false, merged: patch, noop: false, errorCode: 'missing_provider_id' };
  }

  let current = options.currentProgress ?? null;
  if (current == null) {
    try {
      const { data } = await supabase
        .from('providers')
        .select('onboarding_progress')
        .eq('id', providerId)
        .maybeSingle();
      current = ((data as any)?.onboarding_progress as OnboardingProgressRecord) || {};
    } catch {
      current = {};
    }
  }

  const merged = safeProgressMerge(current, patch);

  // No-op: nada mudou de fato — evita write redundante.
  let changed = false;
  for (const k of Object.keys(merged)) {
    if ((current as any)?.[k] !== merged[k]) {
      changed = true;
      break;
    }
  }
  if (!changed && Object.keys(merged).length === Object.keys(current || {}).length) {
    return { ok: true, merged, noop: true };
  }

  try {
    const { error } = await supabase
      .from('providers')
      .update({ onboarding_progress: merged as any })
      .eq('id', providerId);
    if (error) throw error;
    options.tracker?.mark('provider', true);
    return { ok: true, merged, noop: false };
  } catch (e: any) {
    const errorCode = e?.code || e?.name || 'unknown';
    options.tracker?.setFailed('provider');
    await logSyncFailure({
      action: 'phase4_sync_failed', // reaproveita ação existente do registry
      source: options.source,
      snapshot: {
        profile_updated: false,
        provider_updated: false,
        service_created: false,
        failed_step: 'provider',
      },
      errorCode,
      extra: {
        boundary: 'onboarding_progress',
        keys: Object.keys(patch),
      },
    });
    if (options.showToastOnError) showPartialSyncError();
    return { ok: false, merged, noop: false, errorCode };
  }
}
