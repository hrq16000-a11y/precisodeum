/**
 * PhaseRepairContactPhase — wrapper visual da fase auxiliar `phase_repair_contact`.
 *
 * PR 12 (UI Composition Finalization). Apenas composição visual; toda a
 * orquestração (reducer, dispatch RETURN_FROM_REPAIR, telemetria, leitura
 * de sessionStorage para focusField) permanece no shell.
 */
import type { ComponentProps } from 'react';
import { PhaseRepairContact } from '@/components/onboarding/wizard/phases/v2/PhaseRepairContact';

export interface PhaseRepairContactPhaseProps {
  repairProps: ComponentProps<typeof PhaseRepairContact>;
}

export const PhaseRepairContactPhase = ({ repairProps }: PhaseRepairContactPhaseProps) => (
  <PhaseRepairContact {...repairProps} />
);

export default PhaseRepairContactPhase;
