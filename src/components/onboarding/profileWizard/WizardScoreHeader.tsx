import { Progress } from '@/components/ui/progress';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import type { WizardCompletenessResult } from './types';

interface WizardScoreHeaderProps {
  result: WizardCompletenessResult;
  /** Mostra também o item mais pesado faltante. Padrão: true. */
  showNextHint?: boolean;
}

/**
 * Cabeçalho fixo do wizard com a barra de progresso (0–100%) e dica
 * do próximo campo mais impactante a preencher.
 */
const WizardScoreHeader = ({ result, showNextHint = true }: WizardScoreHeaderProps) => {
  const { percentage, missing } = result;
  const isComplete = percentage >= 100;
  const next = missing[0];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground inline-flex items-center gap-1.5">
          {isComplete ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          {percentage}% concluído
        </span>
        {showNextHint && next && !isComplete && (
          <span className="text-muted-foreground">
            Falta: <span className="text-foreground font-medium">{next.label}</span>
          </span>
        )}
      </div>
      <Progress
        value={percentage}
        className="h-2 transition-all duration-500"
        aria-label={`Completude do cadastro: ${percentage}%`}
      />
    </div>
  );
};

export default WizardScoreHeader;
