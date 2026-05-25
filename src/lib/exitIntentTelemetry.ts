/**
 * exitIntentTelemetry — funil persistido em `public.exit_intent_events`.
 *
 * Captura impressão, cliques (cadastro/whatsapp/secundário), dismiss e
 * conversão pós-cadastro. RLS permite INSERT anônimo; SELECT só admin.
 *
 * Usa `sessionStorage` para correlacionar `impression → cta → conversion`
 * mesmo quando o usuário se cadastra em outra sessão (id curto persistido).
 *
 * Cada chamada é "fire and forget" — nunca bloqueia UI nem propaga erros.
 */
import { supabase } from '@/integrations/supabase/client';

export type ExitIntentEventKind =
  | 'impression'
  | 'cta_signup'
  | 'cta_whatsapp'
  | 'cta_secondary'
  | 'dismiss'
  | 'post_signup_conversion';

interface ExitIntentEventInput {
  kind: ExitIntentEventKind;
  pathname: string;
  page_kind?: string | null;
  city?: string | null;
  state?: string | null;
  neighborhood?: string | null;
  source?: string | null;
  user_id?: string | null;
  meta?: Record<string, unknown>;
}

const SESSION_KEY = 'exit_intent_session_id';
const PENDING_CONV_KEY = 'exit_intent_pending_conversion';

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `eis_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return 'eis_unknown';
  }
}

/** Marca que o usuário clicou em "Cadastrar" pelo pop-up — usado para correlacionar conversão. */
export function markPendingExitConversion(meta: Record<string, unknown>): void {
  try {
    localStorage.setItem(
      PENDING_CONV_KEY,
      JSON.stringify({ ...meta, ts: Date.now(), session_id: getSessionId() }),
    );
  } catch {
    /* noop */
  }
}

/** Lê e consome a marca de conversão pendente. Retorna `null` se não houver. */
export function consumePendingExitConversion(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(PENDING_CONV_KEY);
    if (!raw) return null;
    localStorage.removeItem(PENDING_CONV_KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Persiste um evento de funil. Best-effort — falhas de rede/RLS são engolidas.
 * Sempre dispara também um `CustomEvent` no `window` para integrações futuras.
 */
export async function trackExitIntent(input: ExitIntentEventInput): Promise<void> {
  const session_id = getSessionId();
  const ua =
    typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 512) : null;

  const rpcPayload = {
    _kind: input.kind,
    _pathname: input.pathname,
    _page_kind: input.page_kind ?? null,
    _city: input.city ?? null,
    _state: input.state ?? null,
    _neighborhood: input.neighborhood ?? null,
    _source: input.source ?? null,
    _session_id: session_id,
    _user_agent: ua,
    _meta: input.meta ?? {},
  };

  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('precisodeum:telemetry', {
          detail: { event: `exit_intent_${input.kind}`, meta: { ...rpcPayload, user_id: input.user_id ?? null } },
        }),
      );
    }
  } catch {
    /* noop */
  }

  try {
    // RPC SECURITY DEFINER valida e grava (RLS bloqueia INSERT direto).
    await supabase.rpc('log_exit_intent_event' as any, rpcPayload as any);
  } catch (err) {
    if (typeof console !== 'undefined' && import.meta?.env?.DEV) {
      console.debug('[exit-intent-telemetry] insert failed', err);
    }
  }
}

/**
 * Registra a conversão pós-cadastro caso haja marca pendente. Idempotente.
 * Deve ser chamado quando o usuário entra no dashboard pela primeira vez.
 */
export async function maybeTrackPostSignupConversion(userId: string): Promise<void> {
  const pending = consumePendingExitConversion();
  if (!pending) return;
  await trackExitIntent({
    kind: 'post_signup_conversion',
    pathname: typeof window !== 'undefined' ? window.location.pathname : '/dashboard',
    page_kind: (pending.page_kind as string) ?? null,
    city: (pending.city as string) ?? null,
    state: (pending.state as string) ?? null,
    neighborhood: (pending.neighborhood as string) ?? null,
    user_id: userId,
    meta: { from_pending: true, original_ts: pending.ts },
  });
}
