/**
 * OnboardingShellModals — agrupa os dois modais terminais do shell
 * (PR 13 — UI Composition Pass): recuperação de rascunho remoto e
 * modal de erro genérico do wizard.
 *
 * Estritamente presentational: cada callback é repassado tal qual o
 * shell define. Nenhuma decisão de runtime/lifecycle vive aqui — o
 * shell continua dono de `showRemoteModal`, `errorModal`, dispatches
 * e `lastPersistError`.
 */
import { RemoteDraftRecoveryModal } from '@/components/onboarding/wizard/phases/v2/RemoteDraftRecoveryModal';
import WizardErrorModal from '@/components/wizard/WizardErrorModal';

interface RemoteDraftSnapshot {
  payload: unknown;
  phase: string | null;
  updatedAt: string | null;
}

interface ErrorModalSnapshot {
  open: boolean;
  code: string;
  step: string;
  missingFields?: string[];
  technicalMessage: string | null;
  technicalCode: string | null;
  contextSnapshot: {
    category: string | null;
    city: string | null;
    state_uf: string | null;
    lastPersistError: { message: string; code: string | null } | null;
  };
}

interface OnboardingShellModalsProps {
  remote: {
    open: boolean;
    snapshot: RemoteDraftSnapshot;
    onContinue: () => void;
    onDiscard: () => void;
  };
  error: ErrorModalSnapshot & {
    onOpenChange: (open: boolean) => void;
    onRetry: () => void;
    onBack: () => void;
  };
}

export const OnboardingShellModals = ({ remote, error }: OnboardingShellModalsProps) => (
  <>
    <RemoteDraftRecoveryModal
      open={remote.open}
      payload={remote.snapshot.payload as any}
      phase={remote.snapshot.phase as any}
      updatedAt={remote.snapshot.updatedAt}
      onContinue={remote.onContinue}
      onDiscard={remote.onDiscard}
    />

    <WizardErrorModal
      open={error.open}
      onOpenChange={error.onOpenChange}
      code={error.code}
      step={error.step}
      missingFields={error.missingFields}
      technicalMessage={error.technicalMessage}
      technicalCode={error.technicalCode}
      contextSnapshot={error.contextSnapshot}
      onRetry={error.onRetry}
      onBack={error.onBack}
    />
  </>
);

export default OnboardingShellModals;
