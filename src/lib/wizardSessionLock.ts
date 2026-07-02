/**
 * wizardSessionLock — Active-Session Lock para o Wizard de onboarding.
 *
 * Resolve o vazamento arquitetural em que `runOnboardingSelfHeal` marcava
 * `profiles.onboarding_completed=true` em background enquanto o usuário ainda
 * estava dentro do `/cadastro-inicial`, fazendo o `OnboardingGate` ejetar o
 * usuário para o `/dashboard` no próximo re-render.
 *
 * Implementação: **refcount** em `sessionStorage`. Acquire incrementa,
 * release decrementa, ativo se contador > 0. Resolve a janela de race em
 * StrictMode/remount onde uma flag booleana era liberada cedo demais entre
 * o cleanup do `useEffect` e a remontagem (Gate redirecionava nessa fresta).
 *
 * Contrato (interface pública inalterada):
 *  - `acquireWizardSessionLock()`  → contador += 1
 *  - `releaseWizardSessionLock()`  → contador -= 1 (clamp em 0)
 *  - `isWizardSessionLockActive()` → contador > 0
 *
 * Escopo: `sessionStorage` por aba (não persiste entre sessões).
 * Falha: silencioso (try/catch) — nunca lança.
 */

const LEGACY_LOCK_KEY = 'onboarding_wizard_active';
const COUNT_KEY = 'onboarding_wizard_lock_count';

function readCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.sessionStorage.getItem(COUNT_KEY);
    const n = raw == null ? 0 : Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) return 0;
    return n;
  } catch {
    return 0;
  }
}

function writeCount(n: number): void {
  if (typeof window === 'undefined') return;
  try {
    const safe = Math.max(0, n | 0);
    if (safe === 0) {
      window.sessionStorage.removeItem(COUNT_KEY);
      // Limpa a chave booleana legada para evitar leitura inconsistente
      // por consumidores externos que ainda olhem o sessionStorage cru.
      window.sessionStorage.removeItem(LEGACY_LOCK_KEY);
    } else {
      window.sessionStorage.setItem(COUNT_KEY, String(safe));
      window.sessionStorage.setItem(LEGACY_LOCK_KEY, 'true');
    }
  } catch {
    // noop — fail-soft
  }
}

export function acquireWizardSessionLock(): void {
  writeCount(readCount() + 1);
}

export function releaseWizardSessionLock(): void {
  writeCount(readCount() - 1);
}

export function isWizardSessionLockActive(): boolean {
  return readCount() > 0;
}

export const WIZARD_SESSION_LOCK_KEY = LEGACY_LOCK_KEY;
