import { type ObservabilityEnvelope, OBS_STAGE } from './observabilityTypes';

export interface IntegrityReport {
  readonly ok: boolean;
  readonly reasons: ReadonlyArray<string>;
}

export function assertAllObservabilityIntegrity(
  envelope: ObservabilityEnvelope,
): IntegrityReport {
  const reasons: string[] = [];
  if (envelope.stage !== OBS_STAGE) reasons.push('invalid-stage');
  if (envelope.internals.liveExecutionEnabled) reasons.push('live-execution-enabled');
  if (envelope.internals.retryEnabled) reasons.push('retry-enabled');
  if (envelope.internals.backgroundEnabled) reasons.push('background-enabled');
  if (envelope.internals.realUsersAllowed) reasons.push('real-users-allowed');
  if (!Object.isFrozen(envelope)) reasons.push('envelope-not-frozen');
  if (!Object.isFrozen(envelope.graph)) reasons.push('graph-not-frozen');
  if (!Object.isFrozen(envelope.aggregates)) reasons.push('aggregates-not-frozen');
  if (!Object.isFrozen(envelope.stability)) reasons.push('stability-not-frozen');
  return Object.freeze({ ok: reasons.length === 0, reasons: Object.freeze(reasons.slice()) });
}
