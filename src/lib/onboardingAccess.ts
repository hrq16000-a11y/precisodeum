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