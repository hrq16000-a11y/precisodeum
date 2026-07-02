import { fetchExistingFirstService, findExistingProvider } from '@/components/onboarding/wizard/phases/v2/findExistingRecords';
import { isWizardSessionLockActive } from '@/lib/wizardSessionLock';

const ONBOARDING_COMPLETION_GRACE_KEY = 'onboarding_completion_grace_v1';
const ONBOARDING_COMPLETION_GRACE_TTL_MS = 2 * 60 * 1000;

export function markOnboardingCompletionGrace() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(ONBOARDING_COMPLETION_GRACE_KEY, String(Date.now()));
  } catch {
    // noop
  }
}

export function clearOnboardingCompletionGrace() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(ONBOARDING_COMPLETION_GRACE_KEY);
  } catch {
    // noop
  }
}

export function isOnboardingReviewMode(search = '') {
  const params = new URLSearchParams(search);
  return params.get('mode') === 'review' || params.get('review') === '1' || !!getOnboardingReviewSection(search);
}

export type OnboardingReviewSection =
  // Seções clássicas (compat) — apontam para fases main_*
  | 'cadastro'
  | 'servicos'
  | 'dados'
  | 'portfolio'
  | 'url'
  // Modo Assistente "dono do Wizard" (mai/2026): permitem abrir direto em
  // qualquer fase de TRIAGEM (Steps 1-6 da régua unificada). O Wizard hidrata
  // nome/WhatsApp/cidade/foto/documento do banco antes de montar a triagem.
  | 'identidade'
  | 'quem'
  | 'cidade'
  | 'tipo'
  | 'documento'
  | 'local';

const REVIEW_SECTION_VALUES: OnboardingReviewSection[] = [
  'cadastro', 'servicos', 'dados', 'portfolio', 'url',
  'identidade', 'quem', 'cidade', 'tipo', 'documento', 'local',
];

export function getOnboardingReviewSection(search = ''): OnboardingReviewSection | null {
  const params = new URLSearchParams(search);
  const raw = (params.get('section') || '').trim().toLowerCase();
  return (REVIEW_SECTION_VALUES as string[]).includes(raw) ? (raw as OnboardingReviewSection) : null;
}

const POST_LOGIN_REDIRECT_ENTRY_PATHS = new Set([
  '/',
  '/index',
  '/login',
  '/cadastro',
  '/cadastro/rh',
  '/cadastro-inicial',
]);

export function shouldHandlePostLoginRedirect(pathname: string) {
  return POST_LOGIN_REDIRECT_ENTRY_PATHS.has(pathname);
}

export function isOnboardingCompletionGraceActive() {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.sessionStorage.getItem(ONBOARDING_COMPLETION_GRACE_KEY);
    if (!raw) return false;
    const startedAt = Number(raw);
    if (!Number.isFinite(startedAt)) {
      window.sessionStorage.removeItem(ONBOARDING_COMPLETION_GRACE_KEY);
      return false;
    }
    const active = Date.now() - startedAt <= ONBOARDING_COMPLETION_GRACE_TTL_MS;
    if (!active) window.sessionStorage.removeItem(ONBOARDING_COMPLETION_GRACE_KEY);
    return active;
  } catch {
    return false;
  }
}

export function hasUnlockedAppAccess(profile: any | null, hasExistingService = false) {
  if (!profile) return false;

  // Onboarding já concluído explicitamente (fonte de verdade) — libera mesmo
  // que profile_type ainda esteja indefinido por race/legado.
  if (profile.onboarding_completed === true) return true;

  const onboardingStep = Number(profile?.onboarding_step ?? 0);
  if (onboardingStep >= 5) return true;

  if (!profile.profile_type) return false;
  return profile.profile_type === 'provider' && hasExistingService;
}

export function resolveEffectiveProfileType(
  profile: { profile_type?: string | null } | null | undefined,
  provider?: { id?: string | null } | null,
) {
  const explicitType = typeof profile?.profile_type === 'string' && profile.profile_type.trim().length > 0
    ? profile.profile_type
    : null;

  if (explicitType) return explicitType;
  if (provider?.id) return 'provider';
  return null;
}

export function shouldForceOnboarding(profile: any | null, hasExistingService = false) {
  return !hasUnlockedAppAccess(profile, hasExistingService);
}

export function resolveOnboardingGateTarget({
  profile,
  hasExistingService = false,
  completionGraceActive = false,
  pathname,
  search = '',
}: {
  profile: any | null;
  hasExistingService?: boolean;
  completionGraceActive?: boolean;
  pathname: string;
  search?: string;
}) {
  const hasUnlocked = hasUnlockedAppAccess(profile, hasExistingService) || completionGraceActive;
  const mustCompleteOnboarding = !!profile && !hasUnlocked;
  const isOnboardingRoute = pathname === '/cadastro-inicial' || pathname === '/onboarding-v2/sucesso';
  const reviewMode = pathname === '/cadastro-inicial' && isOnboardingReviewMode(search);

  // ── ACTIVE-SESSION LOCK (Fase 1) ────────────────────────────────────────
  // Enquanto o usuário estiver com o Wizard montado em `/cadastro-inicial`
  // a flag `onboarding_wizard_active` está ligada. Nesse caso o Gate NÃO
  // pode redirecionar — independentemente do valor de `onboarding_completed`.
  // Isso elimina a corrida em que `runOnboardingSelfHeal` (ou um update
  // disparado pelo próprio wizard) marca o perfil como completo no meio do
  // fluxo e o Gate eject o usuário para `/dashboard` no próximo re-render.
  if (pathname === '/cadastro-inicial' && isWizardSessionLockActive()) {
    return { action: 'allow' as const, target: null, reason: null };
  }

  if (mustCompleteOnboarding && !isOnboardingRoute) {
    return {
      action: 'redirect' as const,
      target: '/cadastro-inicial',
      reason: 'global-onboarding-gate',
    };
  }

  const alreadyCompleted = !!profile && hasUnlocked;
  if (alreadyCompleted && pathname === '/cadastro-inicial' && !reviewMode) {
    const params = new URLSearchParams(search);
    const nextRaw = params.get('next');
    const isSafeNext = !!nextRaw && nextRaw.startsWith('/') && !nextRaw.startsWith('//') && nextRaw !== '/cadastro-inicial';

    return {
      action: 'redirect' as const,
      target: isSafeNext ? nextRaw! : '/dashboard',
      reason: 'already-completed-blocking-cadastro-inicial',
    };
  }

  return {
    action: 'allow' as const,
    target: null,
    reason: null,
  };
}

export async function resolvePostLoginRoute({
  userId,
  profile,
  provider,
  fallbackAuthorizedRoute = '/dashboard',
}: {
  userId?: string | null;
  profile: any | null;
  provider?: any | null;
  fallbackAuthorizedRoute?: string;
}) {
  if (!profile) return '/cadastro-inicial';
  if (hasUnlockedAppAccess(profile)) return fallbackAuthorizedRoute;
  if (profile.profile_type !== 'provider') return '/cadastro-inicial';

  const providerId = provider?.id ?? await findExistingProvider(userId ?? null, profile?.user_ref ?? null);
  const existingService = await fetchExistingFirstService(
    providerId ?? null,
    profile?.user_ref ?? null,
    provider?.category_id ?? profile?.primary_category_id ?? null,
  );

  return hasUnlockedAppAccess(profile, Boolean(existingService?.id))
    ? fallbackAuthorizedRoute
    : '/cadastro-inicial';
}