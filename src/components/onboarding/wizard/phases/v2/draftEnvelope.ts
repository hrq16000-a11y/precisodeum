/**
 * draftEnvelope — versão + checksum + validação de shape do rascunho local
 * e remoto do Onboarding V2.
 *
 * Objetivos:
 *  - Detectar corrupção silenciosa do localStorage (truncamento, edição manual).
 *  - Descartar envelopes em versão antiga (v1) sem crashar.
 *  - Validar shape mínimo antes de hidratar (profile/service objetos, phase string conhecida).
 *
 * Fail-soft: em qualquer dúvida, retorna `null` e o draft é ignorado.
 */

import { stableChecksum } from '@/lib/lightChecksum';
import type { OnboardingState } from './types';

export const DRAFT_ENVELOPE_VERSION = 2;

const KNOWN_PHASES: ReadonlySet<string> = new Set([
  'phase2_service',
  'phase2_details',
  'phase2_photos',
  'phase3_celebration',
  'phase4_document',
  'phase4_avatar',
  'phase4_extras_a',
  'phase4_extras_b',
  'phase_repair_contact',
  'done',
  // Compat retroativa — fases legadas ainda válidas em sessions antigas.
  'phase1_basic',
  'phase1_action',
  'phase1_kind',
  'phase1_location',
  'phase1_contact',
]);

export interface DraftChecksumInput {
  profile: OnboardingState['profile'];
  service: OnboardingState['service'];
  phase: OnboardingState['phase'];
}

export function computeDraftChecksum(input: DraftChecksumInput): string {
  return stableChecksum({
    p: input.profile ?? {},
    s: input.service ?? {},
    ph: String(input.phase || ''),
  });
}

export interface ValidateShapeResult {
  ok: boolean;
  reason?: 'no_payload' | 'bad_profile' | 'bad_service' | 'bad_phase';
}

export function validateDraftShape(payload: {
  profile?: unknown;
  service?: unknown;
  phase?: unknown;
}): ValidateShapeResult {
  if (!payload) return { ok: false, reason: 'no_payload' };
  if (typeof payload.profile !== 'object' || payload.profile === null) {
    return { ok: false, reason: 'bad_profile' };
  }
  if (typeof payload.service !== 'object' || payload.service === null) {
    return { ok: false, reason: 'bad_service' };
  }
  if (typeof payload.phase !== 'string' || !KNOWN_PHASES.has(payload.phase)) {
    return { ok: false, reason: 'bad_phase' };
  }
  return { ok: true };
}
