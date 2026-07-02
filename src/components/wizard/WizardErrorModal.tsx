/**
 * WizardErrorModal — modal claro de erro do onboarding.
 *
 * Substitui (ou complementa) o toast genérico quando a persistência falha.
 * Mostra:
 *   - Código canônico (ex.: persist_first_service:no_provider)
 *   - Lista de campos faltantes (se houver)
 *   - Mensagem técnica + código do banco
 *   - CTAs: Voltar e completar / Tentar novamente
 *
 * Props mínimas para que possa ser reusado por qualquer fase.
 */
import { AlertTriangle, ArrowLeft, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import ReportWizardErrorButton from '@/components/wizard/ReportWizardErrorButton';

export interface WizardErrorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Código canônico do erro (de wizardErrorCodes). */
  code: string;
  /** Etapa atual do wizard (para o ReportWizardErrorButton). */
  step: string;
  /** Título amigável (default: "Algo travou no cadastro"). */
  title?: string;
  /** Lista de campos faltantes — se vazia, oferece retry. */
  missingFields?: string[];
  /** Mensagem técnica (DB/network). */
  technicalMessage?: string | null;
  /** Código técnico (DB code). */
  technicalCode?: string | null;
  /** Categoria/cidade etc. para contexto do report. */
  contextSnapshot?: Record<string, unknown>;
  onRetry?: () => void;
  onBack?: () => void;
}

export const WizardErrorModal = ({
  open,
  onOpenChange,
  code,
  step,
  title = 'Algo travou no cadastro',
  missingFields,
  technicalMessage,
  technicalCode,
  contextSnapshot,
  onRetry,
  onBack,
}: WizardErrorModalProps) => {
  const hasMissing = !!missingFields && missingFields.length > 0;

  const description = hasMissing
    ? `Falta preencher: ${missingFields!.join(', ')}.`
    : technicalMessage
      ? `Erro técnico: ${technicalMessage.slice(0, 200)}${technicalCode ? ` [cod: ${technicalCode}]` : ''}.`
      : 'Sua conexão pode ter caído. Tente novamente — se persistir, reporte ao suporte.';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" data-testid="wizard-error-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border bg-muted/40 p-2 text-[11px] text-muted-foreground">
          <p className="font-medium text-foreground">Detalhes técnicos</p>
          <ul className="mt-1 space-y-0.5">
            <li>Código: <code className="font-mono" data-testid="wizard-error-modal-code">{code}</code></li>
            {hasMissing && (
              <li>Campos: <code className="font-mono break-all">{missingFields!.join(', ')}</code></li>
            )}
            {technicalMessage && (
              <li>Mensagem: <code className="font-mono break-all">{technicalMessage.slice(0, 160)}</code></li>
            )}
            {technicalCode && (
              <li>DB cod: <code className="font-mono">{technicalCode}</code></li>
            )}
          </ul>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {hasMissing ? (
            <Button
              type="button"
              onClick={() => { onOpenChange(false); onBack?.(); }}
              data-testid="wizard-error-modal-back"
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar e completar
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => { onOpenChange(false); onRetry?.(); }}
              data-testid="wizard-error-modal-retry"
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" /> Tentar novamente
            </Button>
          )}
          <ReportWizardErrorButton
            step={step}
            label="Reportar para o suporte"
            variant="outline"
            contextSnapshot={{
              code,
              missing_fields: missingFields,
              tech_message: technicalMessage,
              tech_code: technicalCode,
              ...contextSnapshot,
            }}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WizardErrorModal;
