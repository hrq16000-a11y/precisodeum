import { initialOnboardingState, phaseIndex } from './state';
import type { AccountKind, OnboardingPhase, OnboardingState } from './types';

type BootstrapInput = {
  profile: any | null;
  provider: any | null;
};

type DraftLike = Partial<OnboardingState> | null;

export type OnboardingCoreLocks = {
  full_name: boolean;
  whatsapp: boolean;
  city: boolean;
  state: boolean;
};

function normalizePhone(value: unknown): string {
  const digits = typeof value === 'string' ? value.replace(/\D/g, '') : '';
  return digits.replace(/^55(?=\d{10,11}$)/, '');
}

function inferKind(profile: any | null, provider: any | null): AccountKind {
  const raw = String(provider?.account_type || profile?.account_type || '').toLowerCase();
  if (raw === 'pj' || raw === 'company' || raw === 'empresa' || raw === 'agency') return 'pj';
  return 'pf';
}

function resolvePhase(fullName: string, whatsapp: string, city: string): OnboardingPhase {
  const hasContact = fullName.trim().length >= 4 && whatsapp.length >= 10;
  if (hasContact && city.trim().length > 0) return 'phase2_service';
  if (city.trim().length > 0 || hasContact) return hasContact ? 'phase2_service' : 'phase1_contact';
  return 'phase1_location';
}

export function buildOnboardingCoreLocks({ profile, provider }: BootstrapInput): OnboardingCoreLocks {
  const full_name = String(profile?.full_name || '').trim();
  const whatsapp = normalizePhone(profile?.whatsapp || provider?.whatsapp || provider?.phone || '');
  const city = String(provider?.city || profile?.city || '').trim();
  const state = String(provider?.state || profile?.state || '').trim();

  return {
    full_name: full_name.length >= 4,
    whatsapp: whatsapp.length >= 10,
    city: city.length > 0,
    state: state.length === 2,
  };
}

export function getPendingOnboardingCoreFields(locks: OnboardingCoreLocks): Array<keyof OnboardingCoreLocks> {
  return (Object.keys(locks) as Array<keyof OnboardingCoreLocks>).filter((key) => !locks[key]);
}

export function resolveOnboardingV2SeedState({
  draft,
  bootstrap,
  source,
}: {
  draft: DraftLike;
  bootstrap: DraftLike;
  source?: string | null;
}): Partial<OnboardingState> {
  const draftPhase = draft?.phase ? phaseIndex(draft.phase) : -1;
  const bootstrapPhase = bootstrap?.phase ? phaseIndex(bootstrap.phase) : -1;
  const forceBootstrapFromBet = source === 'bet-first-service' && bootstrapPhase >= phaseIndex('phase2_service');

  const phase = forceBootstrapFromBet
    ? bootstrap?.phase
    : draftPhase >= bootstrapPhase
      ? draft?.phase ?? bootstrap?.phase
      : bootstrap?.phase ?? draft?.phase;

  return {
    ...(forceBootstrapFromBet ? draft : bootstrap),
    ...(forceBootstrapFromBet ? bootstrap : draft),
    profile: {
      ...initialOnboardingState.profile,
      ...(bootstrap?.profile || {}),
      ...(draft?.profile || {}),
      ...(forceBootstrapFromBet ? (bootstrap?.profile || {}) : {}),
    },
    service: {
      ...initialOnboardingState.service,
      ...(bootstrap?.service || {}),
      ...(draft?.service || {}),
      ...(forceBootstrapFromBet ? (bootstrap?.service || {}) : {}),
    },
    providerId: forceBootstrapFromBet
      ? bootstrap?.providerId ?? draft?.providerId ?? null
      : draft?.providerId ?? bootstrap?.providerId ?? null,
    firstServiceId: draft?.firstServiceId ?? bootstrap?.firstServiceId ?? null,
    phase,
  };
}

export function buildOnboardingV2BootstrapState({ profile, provider }: BootstrapInput): Partial<OnboardingState> | null {
  const isProviderJourney = profile?.profile_type === 'provider' || !!provider;
  if (!isProviderJourney) return null;

  const full_name = String(profile?.full_name || '').trim();
  const whatsapp = normalizePhone(profile?.whatsapp || provider?.whatsapp || provider?.phone || '');
  const city = String(provider?.city || profile?.city || '').trim();
  const state = String(provider?.state || profile?.state || '').trim().toUpperCase().slice(0, 2);
  const neighborhood = String(provider?.neighborhood || profile?.neighborhood || '').trim();
  const bio = String(provider?.description || profile?.bio || '').trim();
  const instagram_url = String(provider?.instagram_url || profile?.instagram_url || '').trim();
  const facebook_url = String(provider?.facebook_url || profile?.facebook_url || '').trim();
  const working_hours = String(provider?.working_hours || '').trim();
  const primary_category_id = provider?.category_id || profile?.primary_category_id || null;

  const hasReusableBasics = !!(full_name || whatsapp || city || state || provider?.id);
  if (!hasReusableBasics) return null;

  return {
    phase: resolvePhase(full_name, whatsapp, city),
    providerId: provider?.id ?? null,
    profile: {
      profile_type: 'provider',
      kind: inferKind(profile, provider),
      full_name,
      whatsapp,
      document: '',
      city,
      state,
      avatar_url: profile?.avatar_url ?? null,
      neighborhood,
      bio,
      instagram_url,
      facebook_url,
      primary_category_id,
      working_hours,
    },
    service: {
      service_name: '',
      description: '',
      category_ids: primary_category_id ? [primary_category_id] : [],
      cities_served: city ? [city] : [],
      starting_price_brl: typeof provider?.starting_price === 'number' ? provider.starting_price : null,
      working_hours,
    },
  };
}