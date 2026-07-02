/**
 * Phase2DetailsPhase — wrapper visual da fase `phase2_details`.
 *
 * PR 10 (UI Composition Pass). Renderiza
 * `<Phase2Details> + <WizardEncouragement>` com props já ligados pelo shell.
 * Sem runtime, sem reducer, sem persistência.
 */
import type { ComponentProps } from 'react';
import { Phase2Details } from '@/components/onboarding/wizard/phases/v2/Phase2Service';
import WizardEncouragement from '@/components/onboarding/wizard/WizardEncouragement';

export interface Phase2DetailsPhaseProps {
  detailsProps: ComponentProps<typeof Phase2Details>;
  encouragement: ComponentProps<typeof WizardEncouragement>;
}

export const Phase2DetailsPhase = ({
  detailsProps,
  encouragement,
}: Phase2DetailsPhaseProps) => (
  <>
    <Phase2Details {...detailsProps} />
    <WizardEncouragement {...encouragement} />
  </>
);

export default Phase2DetailsPhase;
