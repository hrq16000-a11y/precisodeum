import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useWizardCompleteness } from '@/hooks/useWizardCompleteness';
import WizardScoreHeader from './WizardScoreHeader';
import type {
  ProfileWizardData,
  ProfileWizardProps,
  WizardMode,
} from './types';

/**
 * Estado inicial seguro do wizard. Mantém todas as chaves definidas
 * para que o React renderize controlled inputs sem warnings.
 */
function buildInitialState(
  mode: WizardMode,
  initial: Partial<ProfileWizardData> | undefined,
): ProfileWizardData {
  return {
    id: initial?.id,
    kind: initial?.kind ?? 'pf',
    full_name: initial?.full_name ?? '',
    whatsapp: initial?.whatsapp ?? '',
    document: initial?.document ?? '',
    category: initial?.category ?? 'all',
    bio: initial?.bio ?? '',
    avatar_url: initial?.avatar_url ?? null,
    city: initial?.city ?? '',
    state: initial?.state ?? '',
  };
}

/**
 * ProfileWizard — shell base refatorado (Frentes 1 e 2).
 *
 * Frente 1: aceita `mode` e `initialData`; em 'edit' o passo PF/PJ
 *           é pulado e o botão final muda para "Salvar Alterações".
 * Frente 2: exibe barra de completude (0–100%) fixa no cabeçalho.
 *
 * As Frentes 3 (auto-save), 4 (duplicidade) e 5 (preview) serão
 * plugadas neste mesmo shell nas próximas iterações.
 */
const ProfileWizard = ({ mode, initialData, onFinish, onCancel }: ProfileWizardProps) => {
  const [data, setData] = useState<ProfileWizardData>(() => buildInitialState(mode, initialData));
  const [isSaving, setIsSaving] = useState(false);

  // Em modo edit: pula o passo 0 (escolha PF/PJ).
  const startStep = mode === 'edit' ? 1 : 0;
  const [step, setStep] = useState<number>(startStep);

  const completeness = useWizardCompleteness(data);

  const finishLabel = useMemo(
    () => (mode === 'edit' ? 'Salvar Alterações' : 'Concluir Cadastro'),
    [mode],
  );

  const handleFinish = async () => {
    if (!onFinish) return;
    setIsSaving(true);
    try {
      await onFinish(data);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho fixo com score (Frente 2) */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pb-2 border-b border-border">
        <WizardScoreHeader result={completeness} />
      </div>

      {/* Conteúdo dos passos — esqueleto inicial.
          A implementação completa de cada step será portada do
          SmartOnboardingWizard em iterações seguintes. */}
      <div className="min-h-[200px] py-2 text-sm text-muted-foreground">
        {mode === 'create' && step === 0 && (
          <p>Passo 1 — Escolha entre Pessoa Física ou Jurídica (a portar).</p>
        )}
        {step >= 1 && (
          <p>
            Passo {step + 1} — Conteúdo do formulário (modo:{' '}
            <span className="font-medium text-foreground">{mode}</span>).
          </p>
        )}
      </div>

      {/* Footer de navegação */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
        {onCancel ? (
          <Button variant="ghost" type="button" onClick={onCancel} disabled={isSaving}>
            Cancelar
          </Button>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-2">
          {step > startStep && (
            <Button
              variant="outline"
              type="button"
              onClick={() => setStep((s) => Math.max(startStep, s - 1))}
              disabled={isSaving}
            >
              Voltar
            </Button>
          )}
          <Button
            type="button"
            onClick={() => {
              // Placeholder de avanço — substitui pela validação real por step
              // quando os steps forem portados.
              if (step < 4) setStep((s) => s + 1);
              else void handleFinish();
            }}
            disabled={isSaving}
          >
            {step < 4 ? 'Avançar' : finishLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProfileWizard;

// Reexports utilitários para consumidores externos do wizard.
export type { ProfileWizardData, ProfileWizardProps, WizardMode } from './types';
export { useWizardCompleteness } from '@/hooks/useWizardCompleteness';
