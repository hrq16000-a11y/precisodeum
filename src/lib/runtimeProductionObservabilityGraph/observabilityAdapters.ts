import { deepFreeze, sigOf } from './observabilityTypes';
import { type ObservabilityEnvelope } from './observabilityTypes';

export interface ObservabilityAdapter {
  readonly name: string;
  readonly inert: true;
  readonly signature: string;
}

export function buildObservabilityAdapter(name: string): ObservabilityAdapter {
  return deepFreeze({
    name,
    inert: true as const,
    signature: sigOf({ name, inert: true }),
  });
}

export function adapterAccepts(envelope: ObservabilityEnvelope): boolean {
  return envelope.stage === 'STAGE_0_READ_ONLY' && envelope.internals.liveExecutionEnabled === false;
}
