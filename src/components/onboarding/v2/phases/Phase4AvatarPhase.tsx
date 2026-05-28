/**
 * Phase4AvatarPhase — wrapper visual da fase `phase4_avatar`.
 *
 * PR 11 (UI Composition Pass). Composição apenas; o write canônico do avatar
 * (`setUserAvatar`), telemetria e dispatch continuam no shell.
 */
import type { ComponentProps } from 'react';
import { Phase4Avatar } from '@/components/onboarding/wizard/phases/v2/Phase4Final';

export interface Phase4AvatarPhaseProps {
  avatarProps: ComponentProps<typeof Phase4Avatar>;
}

export const Phase4AvatarPhase = ({ avatarProps }: Phase4AvatarPhaseProps) => (
  <Phase4Avatar {...avatarProps} />
);

export default Phase4AvatarPhase;
