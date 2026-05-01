import { fetchExistingFirstService, findExistingProvider } from '@/components/onboarding/wizard/phases/v2/findExistingRecords';

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
  if (!profile?.profile_type) return false;

  const onboardingStep = Number(profile?.onboarding_step ?? 0);
  if (profile.onboarding_completed === true) return true;
  if (onboardingStep >= 5) return true;

  return profile.profile_type === 'provider' && hasExistingService;
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

  if (mustCompleteOnboarding && !isOnboardingRoute) {
    return {
      action: 'redirect' as const,
      target: '/cadastro-inicial',
      reason: 'global-onboarding-gate',
    };
  }

  const alreadyCompleted = !!profile && hasUnlocked;
  if (alreadyCompleted && pathname === '/cadastro-inicial') {
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