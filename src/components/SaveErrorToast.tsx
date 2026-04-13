/**
 * SaveErrorToast — Rich toast for save failures with recovery guidance.
 * Call showSaveError() after a save operation fails.
 */

import { toast } from 'sonner';
import { reportError, trackAction } from '@/lib/errorReporter';

interface SaveErrorOptions {
  actionContext: string;
  componentName: string;
  errorMessage: string;
  errorStack?: string;
  retryFn?: () => void;
}

export async function showSaveError(opts: SaveErrorOptions) {
  trackAction('save_error_shown', opts.actionContext);
  
  // Report to backend
  const reportId = await reportError({
    errorMessage: opts.errorMessage,
    errorStack: opts.errorStack,
    componentName: opts.componentName,
    actionContext: opts.actionContext,
    severity: 'error',
  });

  const shortId = reportId ? reportId.slice(0, 8) : null;

  toast.error('Erro ao salvar', {
    description: `${opts.errorMessage}${shortId ? ` (Cód: ${shortId})` : ''}. Tente novamente. Se persistir, tire um print e envie ao suporte.`,
    duration: 12000,
    action: opts.retryFn
      ? {
          label: 'Tentar novamente',
          onClick: opts.retryFn,
        }
      : undefined,
  });

  return reportId;
}
