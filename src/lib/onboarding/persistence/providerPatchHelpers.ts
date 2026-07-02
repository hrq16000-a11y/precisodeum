/**
 * Helpers puros de normalização de patch do provider, extraídos do
 * OnboardingV2Shell (PR 4 — extração de infraestrutura não-visual).
 *
 * Sem side-effects, sem dependência de React, sem alteração de comportamento.
 * Cada função recebe entrada e devolve nova saída — idêntico ao código inline
 * que vivia no topo do shell.
 */

import { toast } from 'sonner';
import { detectForbiddenAddressKeys } from '@/lib/providerPayload';

// Aviso única vez por sessão para evitar spam (mesmo flag-singleton do shell).
let _addressWarnedOnce = false;
export function warnIfForbiddenAddress(payload: Record<string, unknown>) {
  const found = detectForbiddenAddressKeys(payload);
  if (found.length > 0 && !_addressWarnedOnce) {
    _addressWarnedOnce = true;
    toast.warning('Campos de endereço ignorados', {
      description: `Os campos ${found.join(', ')} não são salvos — usamos só cidade, estado e bairro. Seu cadastro foi salvo normalmente.`,
      duration: 6000,
    });
  }
}

export function parseServiceAreaToCities(value: string | null | undefined): string[] {
  return String(value || '')
    .split(/[;|•\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseStartingPrice(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = parseFloat(String(value).replace(/[^\d,.]/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildProviderSocialPatch(
  patch: Record<string, any>,
  currentProfile: { instagram_url?: string; facebook_url?: string; website_url?: string },
) {
  const nextPatch = { ...patch };
  const hasSocialKeys =
    'instagram_url' in nextPatch ||
    'facebook_url' in nextPatch ||
    'website' in nextPatch ||
    'website_url' in nextPatch;
  if (!hasSocialKeys) return nextPatch;

  const socialLinks = {
    instagram: nextPatch.instagram_url ?? currentProfile.instagram_url ?? null,
    facebook: nextPatch.facebook_url ?? currentProfile.facebook_url ?? null,
  };

  delete nextPatch.instagram_url;
  delete nextPatch.facebook_url;

  if ('website_url' in nextPatch && !('website' in nextPatch)) {
    nextPatch.website = nextPatch.website_url;
  }
  delete nextPatch.website_url;

  nextPatch.social_links = socialLinks;
  return nextPatch;
}

export function withProviderLocationFallback(
  patch: Record<string, any>,
  profile: {
    city?: string;
    state?: string;
    neighborhood?: string;
    latitude?: number | null;
    longitude?: number | null;
  },
) {
  const next = { ...patch };
  if (!('city' in next) || typeof next.city !== 'string' || !next.city.trim()) {
    next.city = profile.city || '';
  }
  if (!('state' in next) || typeof next.state !== 'string' || !next.state.trim()) {
    next.state = profile.state || '';
  }
  if (!('neighborhood' in next) || typeof next.neighborhood !== 'string' || !next.neighborhood.trim()) {
    next.neighborhood = profile.neighborhood || '';
  }
  if ((next.latitude == null || next.longitude == null) && profile.latitude != null && profile.longitude != null) {
    next.latitude = profile.latitude;
    next.longitude = profile.longitude;
  }
  return next;
}

export function slugify(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}
