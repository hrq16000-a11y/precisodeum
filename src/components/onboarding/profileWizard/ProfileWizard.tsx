import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useWizardCompleteness } from '@/hooks/useWizardCompleteness';
import { useWizardAutoSave, readWizardDraft } from '@/hooks/useWizardAutoSave';
import { useWizardDuplicateCheck } from '@/hooks/useWizardDuplicateCheck';
import WizardScoreHeader from './WizardScoreHeader';
import PublicProfilePreview from './PublicProfilePreview';
import Step1ProfileType from './Step1ProfileType';
import type {
  ProfileWizardData,
  ProfileWizardProps,
  WizardMode,
  ProfileTypeChoice,
} from './types';

/** Estado inicial seguro do wizard. */
function buildInitialState(
  mode: WizardMode,
  initial: Partial<ProfileWizardData> | undefined,
): ProfileWizardData {
  // Em modo create, hidrata com draft local se houver.
  const draft = mode === 'create' ? readWizardDraft() : null;
  const merged = { ...(draft || {}), ...(initial || {}) };
  return {
    id: merged.id,
    kind: merged.kind ?? 'pf',
    full_name: merged.full_name ?? '',
    whatsapp: merged.whatsapp ?? '',
    document: merged.document ?? '',
    category: merged.category ?? 'all',
    bio: merged.bio ?? '',
    avatar_url: merged.avatar_url ?? null,
    city: merged.city ?? '',
    state: merged.state ?? '',
  };
}

/**
 * Total de passos do wizard. Em 'edit' o passo 0 (PF/PJ) é pulado.
 * Estrutura:
 *   0 — escolha PF/PJ (apenas create)
 *   1 — identificação (nome, whatsapp, doc)
 *   2 — categoria
 *   3 — bio + avatar
 *   4 — localização
 *   5 — revisão / preview público
 */
const TOTAL_STEPS = 6;
const LAST_STEP = TOTAL_STEPS - 1;

const ProfileWizard = ({ mode, initialData, onFinish, onCancel }: ProfileWizardProps) => {
  const { user } = useAuth();
  const [data, setData] = useState<ProfileWizardData>(() => buildInitialState(mode, initialData));
  const [isSaving, setIsSaving] = useState(false);

  const startStep = mode === 'edit' ? 1 : 0;
  const [step, setStep] = useState<number>(startStep);

  const completeness = useWizardCompleteness(data);

  // Frente 3 — auto-save com debounce + draft local
  const ignoreUserId = mode === 'edit' ? user?.id : undefined;
  const { status: saveStatus, lastSavedAt, clearDraft } = useWizardAutoSave({
    data,
    mode,
    userId: user?.id,
    remote: mode === 'edit', // create: só draft local até concluir
  });

  // Frente 4 — validação de duplicidade inline (onBlur)
  const { checking, duplicates, checkWhatsapp, checkTaxId, reset: resetDup } =
    useWizardDuplicateCheck();

  const finishLabel = useMemo(
    () => (mode === 'edit' ? 'Salvar Alterações' : 'Concluir Cadastro'),
    [mode],
  );

  // Handlers de blur para os campos sensíveis (consumidos pelos steps)
  const handleWhatsappBlur = async () => {
    const dup = await checkWhatsapp(data.whatsapp, ignoreUserId);
    if (dup) toast.error('Este WhatsApp já está cadastrado em outra conta.');
  };
  const handleDocumentBlur = async () => {
    const dup = await checkTaxId(data.document, ignoreUserId);
    if (dup) toast.error('Este CPF/CNPJ já está cadastrado em outra conta.');
  };

  // Bloqueia avanço se duplicidade detectada nos campos do passo atual
  const canAdvance = (): boolean => {
    if (step === 1 && (duplicates.whatsapp || duplicates.tax_id)) {
      toast.error('Corrija os campos duplicados antes de continuar.');
      return false;
    }
    return true;
  };

  const handleAdvance = async () => {
    if (step === 1) {
      // Re-checa antes de seguir (defesa em profundidade)
      const [w, t] = await Promise.all([
        checkWhatsapp(data.whatsapp, ignoreUserId),
        checkTaxId(data.document, ignoreUserId),
      ]);
      if (w || t) {
        toast.error('WhatsApp ou CPF/CNPJ já cadastrado.');
        return;
      }
    }
    if (!canAdvance()) return;
    if (step < LAST_STEP) {
      setStep((s) => s + 1);
    } else {
      await handleFinish();
    }
  };

  const handleFinish = async () => {
    if (!onFinish) return;
    setIsSaving(true);
    try {
      await onFinish(data);
      clearDraft();
    } finally {
      setIsSaving(false);
    }
  };

  // Reset duplicates quando o usuário corrige os campos
  useEffect(() => {
    if (duplicates.whatsapp) resetDup('whatsapp');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.whatsapp]);
  useEffect(() => {
    if (duplicates.tax_id) resetDup('tax_id');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.document]);

  // Indicador visual do auto-save
  const renderSaveStatus = () => {
    if (saveStatus === 'saving')
      return (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Salvando...
        </span>
      );
    if (saveStatus === 'saved' && lastSavedAt)
      return (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3 w-3 text-primary" /> Rascunho salvo
        </span>
      );
    if (saveStatus === 'error')
      return (
        <span className="inline-flex items-center gap-1 text-xs text-destructive">
          <AlertTriangle className="h-3 w-3" /> Falha ao salvar — tentaremos novamente
        </span>
      );
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho fixo com score + indicador de auto-save */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pb-2 border-b border-border space-y-1">
        <WizardScoreHeader result={completeness} />
        <div className="flex justify-end">{renderSaveStatus()}</div>
      </div>

      {/* Conteúdo dos passos.
          Os steps reais (formulários) serão portados do SmartOnboardingWizard
          em iteração subsequente, reutilizando os handlers `handleWhatsappBlur`,
          `handleDocumentBlur` e o estado `data`/`setData` deste shell. */}
      <div className="min-h-[240px] py-2 text-sm">
        {mode === 'create' && step === 0 && (
          <Step1ProfileType
            existingProfileType={(data.profile_type as ProfileTypeChoice | undefined) ?? null}
            onContinueProfileUpdate={() => setStep(1)}
            onSelectType={(type, subtype) => {
              setData((prev) => ({
                ...prev,
                profile_type: type,
                kind: subtype === 'company' ? 'pj' : 'pf',
              }));
              setStep(1);
            }}
          />
        )}
        {step === 1 && (
          <div className="text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">Passo 2 — Identificação</p>
            <p>Nome, WhatsApp e CPF/CNPJ — validação de duplicidade ativa via onBlur.</p>
            {checking.whatsapp && (
              <p className="text-xs">Verificando WhatsApp no servidor...</p>
            )}
            {checking.tax_id && (
              <p className="text-xs">Verificando CPF/CNPJ no servidor...</p>
            )}
          </div>
        )}
        {step === 2 && (
          <p className="text-muted-foreground">Passo 3 — Categoria principal (a portar).</p>
        )}
        {step === 3 && (
          <p className="text-muted-foreground">Passo 4 — Bio e foto de perfil (a portar).</p>
        )}
        {step === 4 && (
          <p className="text-muted-foreground">Passo 5 — Localização (cidade/UF) (a portar).</p>
        )}
        {step === LAST_STEP && (
          <div className="space-y-3">
            <p className="font-medium text-foreground">Passo 6 — Revisão</p>
            <p className="text-xs text-muted-foreground">
              Confira como seu perfil aparecerá publicamente. Volte se algo estiver incorreto.
            </p>
            <PublicProfilePreview data={data} />
          </div>
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
            onClick={handleAdvance}
            disabled={isSaving || checking.whatsapp || checking.tax_id}
          >
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {step < LAST_STEP ? 'Avançar' : finishLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProfileWizard;

// Reexports
export type { ProfileWizardData, ProfileWizardProps, WizardMode } from './types';
export { useWizardCompleteness } from '@/hooks/useWizardCompleteness';
export { useWizardAutoSave, readWizardDraft } from '@/hooks/useWizardAutoSave';
export { useWizardDuplicateCheck } from '@/hooks/useWizardDuplicateCheck';
export { default as PublicProfilePreview } from './PublicProfilePreview';
// Helpers expostos para os steps (quando portados)
export { default as WizardScoreHeader } from './WizardScoreHeader';
