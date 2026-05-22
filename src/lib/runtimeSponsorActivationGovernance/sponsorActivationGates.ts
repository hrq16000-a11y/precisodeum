export interface SponsorActivationGate {
  readonly id: string;
  readonly order: number;
  readonly status: 'CLOSED_READY';
}

export const ACTIVATION_GATES: ReadonlyArray<SponsorActivationGate> = Object.freeze([
  Object.freeze({ id: 'gate:formal-readiness', order: 1, status: 'CLOSED_READY' as const }),
  Object.freeze({ id: 'gate:operational-readiness', order: 2, status: 'CLOSED_READY' as const }),
  Object.freeze({ id: 'gate:rollout-governance', order: 3, status: 'CLOSED_READY' as const }),
  Object.freeze({ id: 'gate:activation-certification', order: 4, status: 'CLOSED_READY' as const }),
]);
