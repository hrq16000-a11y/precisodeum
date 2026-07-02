/**
 * Phase4DocumentPhase — wrapper visual da fase `phase4_document`.
 *
 * PR 11 (UI Composition Pass). Composição apenas; persistência (`persistPatch`),
 * locks (`coreLocks.document`), telemetria e dispatch ficam no shell.
 */
import type { ComponentProps } from 'react';
import { Phase4Document } from '@/components/onboarding/wizard/phases/v2/Phase4Final';

export interface Phase4DocumentPhaseProps {
  documentProps: ComponentProps<typeof Phase4Document>;
}

export const Phase4DocumentPhase = ({ documentProps }: Phase4DocumentPhaseProps) => (
  <Phase4Document {...documentProps} />
);

export default Phase4DocumentPhase;
