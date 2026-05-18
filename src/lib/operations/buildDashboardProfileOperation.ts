/**
 * Fase 1.6.8 — Pre-atomic operation boundary.
 * Prepared for future RPC migration.
 *
 * Builds the operation shape for DashboardProfilePage.handleSave.
 * PURE: no supabase calls, no DOM, no side effects. Validations replicate
 * existing client-side guards so we can emit `operation_build_failed`
 * BEFORE the legacy save path attempts a partial write.
 */

import { resolveContactOwner, type ProfileType } from '@/lib/contactOwnership';
import {
  buildFail,
  buildOk,
  type OperationBuildResult,
  type OperationStep,
} from './types';

export interface DashboardProfileInput {
  userId: string | null | undefined;
  profileType: ProfileType;
  fullName: string;
  whatsapp: string;
  phone: string;
  city: string;
  state: string;
  hasCategory: boolean;
  accountKind?: 'autonomo' | 'pj' | string | null;
  cpfDigits?: string;
  cnpjDigits?: string;
}

export function buildDashboardProfileOperation(
  input: DashboardProfileInput,
): OperationBuildResult {
  if (!input.userId) {
    return buildFail('missing_user_id', 'user_required');
  }
  if (!input.fullName.trim()) {
    return buildFail('missing_full_name', 'full_name_required');
  }
  if (!input.city.trim() || !input.state.trim()) {
    return buildFail('missing_location', 'city_and_state_required');
  }
  if (!input.hasCategory) {
    return buildFail('missing_category', 'category_required');
  }
  if (input.accountKind === 'pj' && input.cnpjDigits && input.cnpjDigits.length !== 14) {
    return buildFail('invalid_cnpj_length', 'cnpj_must_be_14_digits');
  }
  if (input.accountKind === 'autonomo' && input.cpfDigits && input.cpfDigits.length !== 11) {
    return buildFail('invalid_cpf_length', 'cpf_must_be_11_digits');
  }

  const steps: OperationStep[] = ['profile', 'provider'];
  return buildOk({
    source: 'dashboard_profile_page',
    profilePatch: { /* shape only — actual values built at call-site */ },
    providerPatch: { /* shape only — actual values built at call-site */ },
    servicePayload: null,
    requiresFinalize: false,
    requiresAvatarSync: false,
    ownership: resolveContactOwner(input.profileType),
    steps,
    dependencies: ['profiles.id', 'providers.user_id'],
  });
}
