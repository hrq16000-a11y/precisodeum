/**
 * wizardSessionLock — Active-Session Lock para o Wizard de onboarding.
 *
 * Resolve o vazamento arquitetural em que `runOnboardingSelfHeal` marcava
 * `profiles.onboarding_completed=true` em background enquanto o usuário ainda
 * estava dentro do `/cadastro-inicial`, fazendo o `OnboardingGate` ejetar o
 * usuário para o `/dashboard` no próximo re-render.
 *
 * Contrato (mínimo, blindado):
 *  - `acquireWizardSessionLock()`  → grava `onboarding_wizard_active=true`
 *  - `releaseWizardSessionLock()`  → remove a chave
 *  - `isWizardSessionLockActive()` → leitura síncrona, segura em SSR
 *
 * Escopo: `sessionStorage` por aba (não persiste entre sessões).
 * Falha: silencioso (try/catch) — nunca lança.
 */

const LOCK_KEY = 'onboarding_wizard_active';

export function acquireWizardSessionLock(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(LOCK_KEY, 'true');
  } catch {
    // noop — fail-soft
  }
}

export function releaseWizardSessionLock(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(LOCK_KEY);
  } catch {
    // noop — fail-soft
  }
}

export function isWizardSessionLockActive(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(LOCK_KEY) === 'true';
  } catch {
    return false;
  }
}

export const WIZARD_SESSION_LOCK_KEY = LOCK_KEY;
