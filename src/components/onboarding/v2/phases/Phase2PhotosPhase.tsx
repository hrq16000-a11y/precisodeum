/**
 * Phase2PhotosPhase — wrapper visual da fase `phase2_photos`.
 *
 * PR 11 (UI Composition Pass). Apenas composição. O shell decide
 * (com base em runtime: firstServiceId/user/coreLocks etc.) qual `view`
 * renderizar e passa props já ligados:
 *
 *   - `view: 'blocked'`  → renderiza `<Phase2PhotosBlockedCard>`
 *   - `view: 'ready'`    → renderiza `<Phase2Photos> + <WizardEncouragement>`
 *
 * Sem reducer, sem dispatch, sem telemetria, sem refs runtime, sem storage.
 */
import type { ComponentProps } from 'react';
import { Phase2Photos } from '@/components/onboarding/wizard/phases/v2/Phase2Photos';
import { Phase2PhotosBlockedCard } from './Phase2PhotosBlockedCard';
import WizardEncouragement from '@/components/onboarding/wizard/WizardEncouragement';

export type Phase2PhotosPhaseProps =
  | {
      view: 'blocked';
      blockedProps: ComponentProps<typeof Phase2PhotosBlockedCard>;
    }
  | {
      view: 'ready';
      photosProps: ComponentProps<typeof Phase2Photos>;
      encouragement: ComponentProps<typeof WizardEncouragement>;
    };

export const Phase2PhotosPhase = (props: Phase2PhotosPhaseProps) => {
  if (props.view === 'blocked') {
    return <Phase2PhotosBlockedCard {...props.blockedProps} />;
  }
  return (
    <>
      <Phase2Photos {...props.photosProps} />
      <WizardEncouragement {...props.encouragement} />
    </>
  );
};

export default Phase2PhotosPhase;
