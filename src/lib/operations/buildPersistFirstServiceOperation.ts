/**
 * Fase 1.6.8 — Pre-atomic operation boundary.
 * Prepared for future RPC migration.
 *
 * Builds the operation shape for OnboardingV2Shell.persistFirstService.
 * PURE: no supabase calls. Encodes the invariant that a provider row + a
 * categoryId are mandatory before we attempt to publish the 1st service.
 */

import { resolveContactOwner } from '@/lib/contactOwnership';
import {
  buildFail,
  buildOk,
  type OperationBuildResult,
  type OperationStep,
} from './types';

export interface PersistFirstServiceInput {
  userId: string | null | undefined;
  providerId: string | null | undefined;
  categoryId: string | null | undefined;
  fullName: string;
  whatsappDigits: string;
  city: string;
  state: string;
}

export function buildPersistFirstServiceOperation(
  input: PersistFirstServiceInput,
): OperationBuildResult {
  if (!input.userId) return buildFail('missing_user_id', 'user_required');
  if (!input.providerId) return buildFail('missing_provider_id', 'provider_required');
  if (!input.categoryId) return buildFail('missing_category_id', 'category_required');
  if (!input.fullName.trim()) return buildFail('missing_full_name', 'full_name_required');
  if ((input.whatsappDigits || '').length < 10) {
    return buildFail('missing_whatsapp', 'whatsapp_required');
  }
  if (!input.city.trim() || !input.state.trim()) {
    return buildFail('missing_location', 'city_and_state_required');
  }

  const steps: OperationStep[] = ['provider', 'service', 'finalize'];
  return buildOk({
    source: 'onboarding_v2_persist_first_service',
    profilePatch: null,
    providerPatch: { /* primary_category_id + identity sync */ },
    servicePayload: { /* first service draft */ },
    requiresFinalize: true,
    requiresAvatarSync: false,
    ownership: resolveContactOwner('provider'),
    steps,
    dependencies: ['providers.id', 'categories.id', 'services.provider_id'],
  });
}
