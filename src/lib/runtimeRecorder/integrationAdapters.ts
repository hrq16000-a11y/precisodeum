/**
 * Fase 1.8.0 — Integration adapters READ-ONLY.
 *
 * Estes adapters NÃO chamam supabase, NÃO disparam writes e NÃO alteram
 * fluxo existente. Eles apenas convertem metadata observada (passada por
 * quem instrumenta) em um `RuntimeWriteTrace` finalizado.
 *
 * Os hooks observacionais nos boundaries existentes (multiWriteSync,
 * executeOperation, avatarSync, onboardingProgressSync, adminWriteBoundary)
 * permanecem fora do caminho crítico — quem decide se chama, chama.
 */

import type { FlowId } from '@/lib/operations/operationRegistry';
import { createRuntimeTrace, appendTraceStep, finalizeRuntimeTrace } from './traceRecorder';
import type {
  RuntimeWriteBoundary,
  RuntimeWriteStep,
  RuntimeWriteTrace,
} from './recorderTypes';

export interface AdapterInputStep extends Omit<RuntimeWriteStep, 'order' | 'boundary'> {}

export interface AdapterInput {
  steps: AdapterInputStep[];
}

function buildTrace(
  flow: FlowId,
  source: RuntimeWriteBoundary,
  input: AdapterInput,
): RuntimeWriteTrace {
  let trace = createRuntimeTrace(flow, source, 'observe_only');
  for (const step of input.steps) {
    trace = appendTraceStep(trace, { ...step, boundary: source });
  }
  return finalizeRuntimeTrace(trace);
}

export function adaptDashboardProfileRuntimeTrace(input: AdapterInput): RuntimeWriteTrace {
  return buildTrace('dashboard_profile_save', 'multiWriteSync', input);
}

export function adaptPersistFirstServiceRuntimeTrace(input: AdapterInput): RuntimeWriteTrace {
  return buildTrace('persist_first_service', 'onboardingProgressSync', input);
}

export function adaptBetFinalizeRuntimeTrace(
  input: AdapterInput,
  kind: 'client' | 'pro' = 'pro',
): RuntimeWriteTrace {
  const flow: FlowId = kind === 'client' ? 'bet_finish_client' : 'bet_finish_pro';
  return buildTrace(flow, 'executeOperation', input);
}

export function adaptProfileTypeSwitchRuntimeTrace(input: AdapterInput): RuntimeWriteTrace {
  return buildTrace('profile_type_switch', 'multiWriteSync', input);
}

export function adaptAvatarSyncRuntimeTrace(input: AdapterInput): RuntimeWriteTrace {
  return buildTrace('avatar_sync', 'avatarSync', input);
}

export function adaptAdminWriteRuntimeTrace(
  input: AdapterInput,
  target: 'profile' | 'provider' = 'profile',
): RuntimeWriteTrace {
  const flow: FlowId = target === 'profile' ? 'admin_profile_update' : 'admin_provider_update';
  return buildTrace(flow, 'adminWriteBoundary', input);
}
