/**
 * Fase 1.6.8 — Pre-atomic operation boundary.
 * Prepared for future RPC migration.
 *
 * Builds the operation shape for ProfileTypeSwitcher.handleSwitch.
 * Ensures we never request impossible transitions (same type, no user).
 */

import { resolveContactOwner, type ProfileType } from '@/lib/contactOwnership';
import {
  buildFail,
  buildOk,
  type OperationBuildResult,
  type OperationStep,
} from './types';

const VALID_TYPES = new Set(['client', 'provider', 'rh']);

export interface ProfileTypeSwitchInput {
  userId: string | null | undefined;
  currentType: ProfileType;
  targetType: string;
}

export function buildProfileTypeSwitchOperation(
  input: ProfileTypeSwitchInput,
): OperationBuildResult {
  if (!input.userId) return buildFail('missing_user_id', 'user_required');
  if (!VALID_TYPES.has(input.targetType)) {
    return buildFail('invalid_target_type', 'unsupported_target_type');
  }
  if (input.currentType === input.targetType) {
    return buildFail('noop_same_type', 'current_equals_target');
  }

  const becomesProvider = input.targetType === 'provider' || input.targetType === 'rh';
  const steps: OperationStep[] = becomesProvider
    ? ['profile_type', 'provider']
    : ['profile_type'];

  return buildOk({
    source: 'profile_type_switcher',
    profilePatch: { profile_type: input.targetType, role: input.targetType },
    providerPatch: becomesProvider ? { /* ensure providers row exists */ } : null,
    servicePayload: null,
    requiresFinalize: false,
    requiresAvatarSync: false,
    ownership: resolveContactOwner(input.targetType as ProfileType),
    steps,
    dependencies: becomesProvider
      ? ['profiles.id', 'providers.user_id']
      : ['profiles.id'],
  });
}
