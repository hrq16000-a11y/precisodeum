/**
 * Phase4ExtrasAPhase — wrapper visual da fase `phase4_extras_a`.
 *
 * PR 10 (UI Composition Pass). Apenas composição visual; toda a
 * persistência (`persistPatch`) e telemetria continuam no shell.
 */
import type { ComponentProps } from 'react';
import { Phase4ExtrasA } from '@/components/onboarding/wizard/phases/v2/Phase4Final';

export interface Phase4ExtrasAPhaseProps {
  extrasProps: ComponentProps<typeof Phase4ExtrasA>;
}

export const Phase4ExtrasAPhase = ({ extrasProps }: Phase4ExtrasAPhaseProps) => (
  <Phase4ExtrasA {...extrasProps} />
);

export default Phase4ExtrasAPhase;
