import type { BetState } from './types';

export type BetRewardKey = keyof BetState['rewards'];

export function awardBetReward(
  state: BetState,
  reward: BetRewardKey,
  points: number,
): BetState {
  if (state.rewards[reward]) return state;

  return {
    ...state,
    points: state.points + points,
    rewards: {
      ...state.rewards,
      [reward]: true,
    },
  };
}