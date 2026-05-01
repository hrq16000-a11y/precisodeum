import { fetchExistingFirstService, findExistingProvider } from '@/components/onboarding/wizard/phases/v2/findExistingRecords';

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
  pathname,
  search = '',
}: {
  profile: any | null;
  hasExistingService?: boolean;
  pathname: string;
  search?: string;
}) {
  const mustCompleteOnboarding = !!profile && shouldForceOnboarding(profile, hasExistingService);
  const isOnboardingRoute = pathname === '/cadastro-inicial' || pathname === '/onboarding-v2/sucesso';

  if (mustCompleteOnboarding && !isOnboardingRoute) {
    return {
      action: 'redirect' as const,
      target: '/cadastro-inicial',
      reason: 'global-onboarding-gate',
    };
  }

  const alreadyCompleted = !!profile && hasUnlockedAppAccess(profile, hasExistingService);
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