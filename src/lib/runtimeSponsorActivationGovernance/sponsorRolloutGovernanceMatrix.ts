export interface SponsorRolloutConstraint {
  readonly id: string;
  readonly scope: 'billing' | 'scheduling' | 'networking' | 'feature' | 'monetization';
  readonly enforcement: 'BLOCK_ACTIVATION';
}

export interface SponsorRolloutGovernanceMatrix {
  readonly constraints: ReadonlyArray<SponsorRolloutConstraint>;
}

export function buildRolloutGovernanceMatrix(): SponsorRolloutGovernanceMatrix {
  const constraints: SponsorRolloutConstraint[] = [
    Object.freeze({ id: 'rollout:billing-disabled', scope: 'billing' as const, enforcement: 'BLOCK_ACTIVATION' as const }),
    Object.freeze({ id: 'rollout:scheduling-disabled', scope: 'scheduling' as const, enforcement: 'BLOCK_ACTIVATION' as const }),
    Object.freeze({ id: 'rollout:networking-readonly', scope: 'networking' as const, enforcement: 'BLOCK_ACTIVATION' as const }),
    Object.freeze({ id: 'rollout:feature-frozen', scope: 'feature' as const, enforcement: 'BLOCK_ACTIVATION' as const }),
    Object.freeze({ id: 'rollout:monetization-disabled', scope: 'monetization' as const, enforcement: 'BLOCK_ACTIVATION' as const }),
  ];
  return Object.freeze({ constraints: Object.freeze(constraints) });
}
