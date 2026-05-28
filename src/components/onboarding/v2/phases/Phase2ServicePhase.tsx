/**
 * Phase2ServicePhase — wrapper visual da fase `phase2_service`.
 *
 * PR 10 (UI Composition Pass). Composição declarativa apenas:
 * recebe os props já materializados pelo shell (callbacks ligados,
 * dados derivados, copy do encouragement) e renderiza o par
 * `<Phase2Service> + <WizardEncouragement>`.
 *
 * REGRAS:
 *  - Não importa runtime, hooks de negócio, telemetria, reducer.
 *  - Não acessa storage, contexto global ou refs.
 *  - Props 100% explícitas; nenhum `any`.
 */
import type { ComponentProps } from 'react';
import { Phase2Service } from '@/components/onboarding/wizard/phases/v2/Phase2Service';
import WizardEncouragement from '@/components/onboarding/wizard/WizardEncouragement';

export interface Phase2ServicePhaseProps {
  serviceProps: ComponentProps<typeof Phase2Service>;
  encouragement: ComponentProps<typeof WizardEncouragement>;
}

export const Phase2ServicePhase = ({
  serviceProps,
  encouragement,
}: Phase2ServicePhaseProps) => (
  <>
    <Phase2Service {...serviceProps} />
    <WizardEncouragement {...encouragement} />
  </>
);

export default Phase2ServicePhase;
