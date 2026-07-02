/**
 * Phase4ExtrasBPhase — wrapper visual da fase `phase4_extras_b`.
 *
 * PR 10 (UI Composition Pass). Toda a lógica (snapshot, persistPatch,
 * navegação) permanece no shell; este wrapper só compõe a UI.
 */
import type { ComponentProps } from 'react';
import { Phase4ExtrasB } from '@/components/onboarding/wizard/phases/v2/Phase4Final';

export interface Phase4ExtrasBPhaseProps {
  extrasProps: ComponentProps<typeof Phase4ExtrasB>;
}

export const Phase4ExtrasBPhase = ({ extrasProps }: Phase4ExtrasBPhaseProps) => (
  <Phase4ExtrasB {...extrasProps} />
);

export default Phase4ExtrasBPhase;
