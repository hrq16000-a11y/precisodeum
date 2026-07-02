/**
 * ProviderIntegrityErrorCard — feedback visual dedicado quando o trigger
 * `guard_provider_activation` (22023) bloqueia a finalização do cadastro.
 *
 * Renderizado inline pelo `PhaseProLocation` (acima do botão Finalizar) sempre
 * que `state.integrity_error` está populado. Substitui a antiga UX de toast
 * efêmero — agora o usuário vê o motivo persistente + CTA dedicado para:
 *   - Revisar o Bairro (foca o input).
 *   - Tentar GPS novamente (dispara nova detecção).
 *   - Revisar Cidade-base.
 *
 * O componente é dumb: recebe o `ProviderIntegrityError` parseado e callbacks.
 * Não conhece nada do reducer/state — facilita teste isolado.
 */
import { AlertTriangle, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ProviderIntegrityError } from '@/lib/providerIntegrityError';

export interface ProviderIntegrityErrorCardProps {
  error: ProviderIntegrityError;
  /** Aciona o CTA principal (foca o campo / dispara GPS). */
  onPrimary: () => void;
  /** Permite ao usuário fechar o aviso (sem dismissar a regra). */
  onDismiss?: () => void;
}

export default function ProviderIntegrityErrorCard({
  error,
  onPrimary,
  onDismiss,
}: ProviderIntegrityErrorCardProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="provider-integrity-error-card"
      data-kind={error.kind}
      className="relative flex items-start gap-3 rounded-2xl border-2 border-bet-error/60 bg-bet-error-soft p-4 shadow-card"
    >
      <AlertTriangle
        className="mt-0.5 h-5 w-5 flex-shrink-0 text-bet-error-fg"
        aria-hidden="true"
      />
      <div className="flex-1 space-y-2">
        <div>
          <p className="text-sm font-bold text-bet-error-fg">{error.title}</p>
          <p className="mt-0.5 text-[13px] leading-snug text-bet-error-fg/90">
            {error.description}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            onClick={onPrimary}
            data-testid="provider-integrity-primary-cta"
            className="h-8 bg-bet-error text-white hover:bg-bet-error/90"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            {error.ctaLabel}
          </Button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              data-testid="provider-integrity-dismiss"
              aria-label="Fechar aviso"
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-bet-error-fg/70 hover:bg-bet-error/10"
            >
              <X className="h-3.5 w-3.5" />
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
