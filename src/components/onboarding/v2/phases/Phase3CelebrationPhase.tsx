/**
 * Phase3CelebrationPhase — wrapper visual da fase `phase3_celebration`.
 *
 * PR 12 (UI Composition Finalization). Apenas composição: o shell
 * mantém telemetria, callbacks, dispatch, lifecycle e finalize ownership.
 */
import type { ComponentProps } from 'react';
import { Phase3Celebration } from '@/components/onboarding/wizard/phases/v2/Phase3Celebration';

export interface Phase3CelebrationPhaseProps {
  celebrationProps: ComponentProps<typeof Phase3Celebration>;
}

export const Phase3CelebrationPhase = ({ celebrationProps }: Phase3CelebrationPhaseProps) => (
  <Phase3Celebration {...celebrationProps} />
);

export default Phase3CelebrationPhase;
