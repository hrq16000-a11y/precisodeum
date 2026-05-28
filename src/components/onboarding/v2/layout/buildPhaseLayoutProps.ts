/**
 * buildPhaseLayoutProps — builders PUROS de payloads/props específicos de
 * fase, extraídos do OnboardingV2Shell (PR 14 — UI-only Shell Surface
 * Reduction). Foca em DRY de objetos verbosos sem mover side-effects.
 *
 * Atualmente exporta:
 *   • `buildRegistrationSnapshotPayload` — payload duplicado em
 *     `phase4_extras_b` (skip + finish). É puramente declarativo: o
 *     callback assíncrono do shell continua chamando `recordRegistration
 *     SnapshotOnce` com este snapshot.
 */
import { TERMS_VERSION, readAccuracyMeters, readVelocityMps } from '@/lib/wizardSnapshotInputs';

interface RegistrationSnapshotProfile {
  whatsapp?: string | null;
  postal_code?: string | null;
  street?: string | null;
  street_number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  kind?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracy_m?: number | null;
  velocity_mps?: number | null;
  [key: string]: unknown;
}

export interface RegistrationSnapshotPayload {
  whatsapp: string | null | undefined;
  postal_code: string | null | undefined;
  street: string | null | undefined;
  street_number: string | null | undefined;
  neighborhood: string | null | undefined;
  city: string | null | undefined;
  state: string | null | undefined;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  velocity_mps: number | null;
  terms_accepted: true;
  terms_version: string;
  origin_summary: {
    flow: 'onboarding_v2';
    account_type: string | null | undefined;
    has_first_service: boolean;
    finished_via: 'skip' | 'finish';
  };
}

export const buildRegistrationSnapshotPayload = (
  profile: RegistrationSnapshotProfile,
  hasFirstService: boolean,
  finishedVia: 'skip' | 'finish',
): RegistrationSnapshotPayload => ({
  whatsapp: profile.whatsapp,
  postal_code: profile.postal_code,
  street: profile.street,
  street_number: profile.street_number,
  neighborhood: profile.neighborhood,
  city: profile.city,
  state: profile.state,
  latitude: (profile as any).latitude ?? null,
  longitude: (profile as any).longitude ?? null,
  accuracy_m: (profile as any).accuracy_m ?? readAccuracyMeters(),
  velocity_mps: (profile as any).velocity_mps ?? readVelocityMps(),
  terms_accepted: true,
  terms_version: TERMS_VERSION,
  origin_summary: {
    flow: 'onboarding_v2',
    account_type: profile.kind,
    has_first_service: hasFirstService,
    finished_via: finishedVia,
  },
});

export default buildRegistrationSnapshotPayload;
