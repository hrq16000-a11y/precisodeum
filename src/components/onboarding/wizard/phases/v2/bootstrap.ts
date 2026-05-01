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
  document: boolean;
};

function normalizePhone(value: unknown): string {
  const digits = typeof value === 'string' ? value.replace(/\D/g, '') : '';
  return digits.replace(/^55(?=\d{10,11}$)/, '');
}

function readSocialLink(source: any, key: string): string {
  const direct = typeof source?.[`${key}_url`] === 'string' ? source[`${key}_url`] : '';
  const nested = typeof source?.social_links?.[key] === 'string' ? source.social_links[key] : '';
  const website = key === 'website' && typeof source?.website === 'string' ? source.website : '';
  return String(direct || nested || website || '').trim();
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
  const documentDigits = String(
    profile?.tax_id || provider?.cpf || provider?.cnpj || ''
  ).replace(/\D/g, '');

  return {
    full_name: full_name.length >= 4,
    whatsapp: whatsapp.length >= 10,
    city: city.length > 0,
    state: state.length === 2,
    document: documentDigits.length === 11 || documentDigits.length === 14,
  };
}

export function getPendingOnboardingCoreFields(locks: OnboardingCoreLocks): Array<keyof OnboardingCoreLocks> {
  return (Object.keys(locks) as Array<keyof OnboardingCoreLocks>).filter((key) => !locks[key]);
}

export function resolveOnboardingV2SeedState({
  draft,
  bootstrap,
  forceFromBootstrap = false,
}: {
  draft: DraftLike;
  bootstrap: DraftLike;
  /**
   * Quando `true`, força o bootstrap a "puxar" o draft para a fase de criação
   * do 1º serviço (saída natural após a triagem unificada). Substitui o antigo
   * o antigo gatilho legado por query string, agora que o handoff é interno.
   *
   * Anti-regressão: se o draft já está em phase4_* / done, NUNCA voltamos.
   */
  forceFromBootstrap?: boolean;
}): Partial<OnboardingState> {
  const draftPhase = draft?.phase ? phaseIndex(draft.phase) : -1;
  const bootstrapPhase = bootstrap?.phase ? phaseIndex(bootstrap.phase) : -1;
  const shouldForce =
    forceFromBootstrap &&
    bootstrapPhase >= phaseIndex('phase2_service') &&
    draftPhase < phaseIndex('phase4_document');

  const phase = shouldForce
    ? bootstrap?.phase
    : draftPhase >= bootstrapPhase
      ? draft?.phase ?? bootstrap?.phase
      : bootstrap?.phase ?? draft?.phase;

  return {
    ...(shouldForce ? draft : bootstrap),
    ...(shouldForce ? bootstrap : draft),
    profile: {
      ...initialOnboardingState.profile,
      ...(bootstrap?.profile || {}),
      ...(draft?.profile || {}),
      ...(shouldForce ? (bootstrap?.profile || {}) : {}),
    },
    service: {
      ...initialOnboardingState.service,
      ...(bootstrap?.service || {}),
      ...(draft?.service || {}),
      ...(shouldForce ? (bootstrap?.service || {}) : {}),
    },
    providerId: shouldForce
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
  const instagram_url = readSocialLink(provider, 'instagram') || readSocialLink(profile, 'instagram');
  const facebook_url = readSocialLink(provider, 'facebook') || readSocialLink(profile, 'facebook');
  const website_url = readSocialLink(provider, 'website') || readSocialLink(profile, 'website');
  const working_hours = String(provider?.working_hours || '').trim();
  const primary_category_id = provider?.category_id || profile?.primary_category_id || null;
  const years_experience = typeof provider?.years_experience === 'number'
    ? provider.years_experience
    : null;

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
      document: String(profile?.tax_id || provider?.cpf || provider?.cnpj || '').replace(/\D/g, ''),
      city,
      state,
      avatar_url: profile?.avatar_url ?? null,
      years_experience,
      neighborhood,
      bio,
      instagram_url,
      facebook_url,
      website_url,
      primary_category_id,
      working_hours,
    },
    service: {
      service_name: '',
      description: '',
      category_ids: primary_category_id ? [primary_category_id] : [],
      cities_served: city ? [city] : [],
      starting_price_brl: typeof provider?.starting_price === 'number' ? provider.starting_price : null,
      working_days: [],
      working_hours,
      working_hours_struct: provider?.working_hours_struct ?? null,
    },
  };
}