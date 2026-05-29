/**
 * WizardNav — barra de navegação inferior global do wizard unificado.
 *
 * - Botão "Voltar" visível em TODO passo (oculto apenas no primeiro e
 *   na celebração final).
 * - Botão "Avançar" opcional com animação de pulso/brilho para reforço
 *   visual. Quando o passo gerencia seu próprio CTA principal (caso da
 *   maioria dos steps atuais), passe `showNext={false}` e use apenas o
 *   Voltar.
 *
 * Este componente NÃO toca no reducer — apenas dispara callbacks. A
 * orquestração de fase (dispatch GO_TO/NEXT) continua no shell.
 */
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WizardNavProps {
  onBack?: () => void;
  onNext?: () => void;
  /** Texto do botão avançar. Default: "Avançar". */
  nextLabel?: string;
  /** Esconde o Voltar (use no primeiro passo / celebração). */
  hideBack?: boolean;
  /** Esconde o Avançar (default true — a maioria dos steps tem CTA próprio). */
  showNext?: boolean;
  /** Desabilita o avançar (validação pendente). */
  nextDisabled?: boolean;
  saving?: boolean;
}

export function WizardNav({
  onBack,
  onNext,
  nextLabel = 'Avançar',
  hideBack = false,
  showNext = false,
  nextDisabled = false,
  saving = false,
}: WizardNavProps) {
  return (
    <div className="sticky bottom-0 left-0 right-0 z-50 mx-auto flex w-full max-w-md items-center justify-between gap-3 border-t border-border bg-background px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      {!hideBack ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
          aria-label="Voltar para o passo anterior"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
      ) : (
        <span aria-hidden className="h-9" />
      )}

      {showNext && onNext && (
        <motion.div
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          className={`rounded-md ${!nextDisabled && !saving ? 'animate-ring-pulse-accent' : ''}`}
        >
          <Button
            type="button"
            onClick={onNext}
            disabled={nextDisabled || saving}
            className="gap-1.5 bg-gradient-to-r from-accent to-primary text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={nextLabel}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {nextLabel}
            {!saving && <ArrowRight className="h-4 w-4" />}
          </Button>
        </motion.div>
      )}
    </div>
  );
}

export default WizardNav;
