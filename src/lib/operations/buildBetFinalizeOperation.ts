/**
 * Fase 1.6.8 — Pre-atomic operation boundary.
 * Prepared for future RPC migration.
 *
 * Builds the operation shape for BetModeShell.finishClient / finishPro.
 * Two intents share one shape; `intent` decides ownership + steps.
 */

import { resolveContactOwner } from '@/lib/contactOwnership';
import {
  buildFail,
  buildOk,
  type OperationBuildResult,
  type OperationStep,
} from './types';

export interface BetFinalizeInput {
  userId: string | null | undefined;
  intent: 'client' | 'pro' | string;
  proKind?: 'pf' | 'pj' | string | null;
  fullName: string;
  whatsappDigits: string;
  city: string;
  state: string;
  documentDigits?: string;
}

export function buildBetFinalizeOperation(
  input: BetFinalizeInput,
): OperationBuildResult {
  if (!input.userId) return buildFail('missing_user_id', 'user_required');
  if (!input.fullName.trim()) return buildFail('missing_full_name', 'full_name_required');
  if ((input.whatsappDigits || '').length < 10) {
    return buildFail('missing_whatsapp', 'whatsapp_required');
  }
  if (!input.city.trim() || !input.state.trim()) {
    return buildFail('missing_location', 'city_and_state_required');
  }

  const isPro = input.intent === 'pro';
  if (isPro && input.proKind && input.proKind !== 'pf' && input.proKind !== 'pj') {
    return buildFail('invalid_pro_kind', 'pro_kind_must_be_pf_or_pj');
  }
  if (isPro && input.proKind === 'pj' && input.documentDigits && input.documentDigits.length !== 14) {
    return buildFail('invalid_cnpj_length', 'cnpj_must_be_14_digits');
  }
  if (isPro && input.proKind === 'pf' && input.documentDigits && input.documentDigits.length > 0 && input.documentDigits.length !== 11) {
    return buildFail('invalid_cpf_length', 'cpf_must_be_11_digits');
  }

  const profileTypeForOwnership = isPro ? 'provider' : 'client';
  const steps: OperationStep[] = isPro
    ? ['profile', 'provider']
    : ['profile', 'finalize'];

  return buildOk({
    source: isPro ? 'bet_finish_pro' : 'bet_finish_client',
    profilePatch: { /* identity + profile_type + tax_id */ },
    providerPatch: isPro ? { /* provider mínimo */ } : null,
    servicePayload: null,
    requiresFinalize: !isPro,
    requiresAvatarSync: false,
    ownership: resolveContactOwner(profileTypeForOwnership),
    steps,
    dependencies: isPro
      ? ['profiles.id', 'providers.user_id']
      : ['profiles.id'],
  });
}
