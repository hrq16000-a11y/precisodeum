/**
 * Wizard error utilities — blindagem de cadastro.
 *
 * - `toastErrorWithRetry`: toast amigável com botão "Tentar novamente".
 * - `logWizardError`: dispara evento `error` em `onboarding_events` com payload
 *   sanitizado (sem PII) para diagnóstico no admin.
 * - `softValidate`: validação "zombie" — não bloqueia o usuário, apenas registra.
 *
 * Filosofia:
 *  - Erros nunca devem deixar o usuário travado.
 *  - Toda falha gera telemetria observável em /admin/onboarding-funnel.
 *  - Mensagens são humanas; detalhes técnicos vão para o log.
 */
import { toast } from 'sonner';
import { trackOnboardingEvent } from '@/components/onboarding/wizard/phases/v2/telemetry';
import type { OnboardingPhase } from '@/components/onboarding/wizard/phases/v2/types';

const PII_KEYS = new Set([
  'full_name', 'name', 'whatsapp', 'phone', 'email', 'cpf', 'cnpj',
  'tax_id', 'document', 'address', 'cep', 'avatar_url',
]);

/** Remove chaves PII de um objeto (1 nível). */
function stripPii<T extends Record<string, unknown>>(obj: T | null | undefined): Record<string, unknown> {
  if (!obj || typeof obj !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (PII_KEYS.has(k)) { out[k] = '[redacted]'; continue; }
    if (typeof v === 'string' && v.length > 200) { out[k] = v.slice(0, 200) + '…'; continue; }
    if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) out[k] = v;
  }
  return out;
}

interface LogErrorArgs {
  phase: OnboardingPhase | string;
  userId?: string | null;
  error: unknown;
  /** contexto adicional (campos do payload, action, etc.) — PII será mascarada. */
  context?: Record<string, unknown>;
  variant?: 'v1' | 'v2';
}

/* ─────────────────────────────────────────────────────────────────────────
 * Attempt counter — conta tentativas de erro por (phase + action key) na
 * sessão atual. Útil para detectar usuários que estão "presos" tentando o
 * mesmo passo várias vezes. Persistido em sessionStorage (não compartilhado
 * entre abas, mas suficiente para correlacionar uma jornada).
 * ───────────────────────────────────────────────────────────────────────── */

const ATTEMPT_KEY = 'wizard_error_attempts_v1';

function readAttempts(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(ATTEMPT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function writeAttempts(map: Record<string, number>): void {
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify(map)); } catch { /* fail-soft */ }
}

/** Incrementa contador de tentativas para `phase:actionKey` e devolve o novo total. */
export function bumpErrorAttempt(phase: string, actionKey = 'default'): number {
  const map = readAttempts();
  const k = `${phase}:${actionKey}`;
  const next = (map[k] || 0) + 1;
  map[k] = next;
  writeAttempts(map);
  return next;
}

/** Lê o contador atual (sem incrementar). */
export function getErrorAttempt(phase: string, actionKey = 'default'): number {
  return readAttempts()[`${phase}:${actionKey}`] || 0;
}

/** Reseta contador — chamar após sucesso. */
export function resetErrorAttempt(phase: string, actionKey = 'default'): void {
  const map = readAttempts();
  delete map[`${phase}:${actionKey}`];
  writeAttempts(map);
}

/** Registra um erro no funil sem bloquear o usuário. Inclui contagem por tentativa. */
export function logWizardError({ phase, userId, error, context, variant }: LogErrorArgs): void {
  const err = error as any;
  const actionKey = (context?.action as string) || 'default';
  const attempt = bumpErrorAttempt(String(phase), actionKey);
  void trackOnboardingEvent({
    phase: phase as OnboardingPhase,
    event: 'error',
    userId: userId ?? null,
    variant,
    meta: {
      message: String(err?.message || err || 'unknown'),
      code: err?.code || err?.status || null,
      details: err?.details ? String(err.details).slice(0, 300) : null,
      hint: err?.hint || null,
      attempt,
      action: actionKey,
      context: stripPii(context),
      ts: new Date().toISOString(),
    },
  });
}

interface RetryToastOpts {
  title?: string;
  description?: string;
  /** Função invocada ao clicar em "Tentar novamente". */
  onRetry?: () => void | Promise<void>;
  /** ms — default 8000 */
  duration?: number;
}

/** Toast amigável com botão "Tentar novamente". */
export function toastErrorWithRetry(opts: RetryToastOpts): string | number {
  const { title = 'Não consegui salvar agora', description, onRetry, duration = 8000 } = opts;
  return toast.error(title, {
    description: description || 'Verifique sua conexão e tente novamente.',
    duration,
    action: onRetry
      ? {
          label: 'Tentar novamente',
          onClick: () => { void onRetry(); },
        }
      : undefined,
  });
}

interface SafeWizardSaveOpts<T> {
  phase: OnboardingPhase | string;
  userId?: string | null;
  variant?: 'v1' | 'v2';
  /** Texto humano para o toast em caso de erro. */
  friendlyMessage?: string;
  /** contexto extra para telemetria (PII será mascarada). */
  context?: Record<string, unknown>;
  /** A função que faz o trabalho. Deve lançar/retornar erro normalmente. */
  fn: () => Promise<T>;
  /** Wrapper para retry — quando o usuário clica em "Tentar novamente". */
  onRetry?: () => void | Promise<void>;
}

/**
 * Executa uma operação de salvamento do wizard com:
 *  - try/catch unificado
 *  - log automático no funil em caso de erro (com payload sanitizado)
 *  - toast amigável + botão "Tentar novamente"
 *
 * Retorna {ok: true, data} ou {ok: false, error}.
 */
export async function safeWizardSave<T>(opts: SafeWizardSaveOpts<T>):
  Promise<{ ok: true; data: T } | { ok: false; error: unknown }>
{
  const actionKey = (opts.context?.action as string) || 'default';
  try {
    const data = await opts.fn();
    resetErrorAttempt(String(opts.phase), actionKey);
    return { ok: true, data };
  } catch (error) {
    logWizardError({
      phase: opts.phase,
      userId: opts.userId,
      error,
      context: opts.context,
      variant: opts.variant,
    });
    toastErrorWithRetry({
      title: opts.friendlyMessage || 'Não consegui salvar agora',
      description: (error as any)?.message?.slice(0, 160) || undefined,
      onRetry: opts.onRetry,
    });
    return { ok: false, error };
  }
}

/**
 * Validação "zombie": registra problemas mas não bloqueia.
 * Usar para sinalizar UI ruim sem travar cadastro (ex: campo opcional mal preenchido).
 */
export function softValidate(
  rules: Array<{ ok: boolean; key: string; message?: string }>,
  ctx: { phase: OnboardingPhase | string; userId?: string | null; variant?: 'v1' | 'v2' },
): { passed: boolean; failures: string[] } {
  const failures = rules.filter((r) => !r.ok).map((r) => r.key);
  if (failures.length > 0) {
    void trackOnboardingEvent({
      phase: ctx.phase as OnboardingPhase,
      event: 'error',
      userId: ctx.userId ?? null,
      variant: ctx.variant,
      meta: { kind: 'soft_validation', failures, count: failures.length },
    });
  }
  return { passed: failures.length === 0, failures };
}
