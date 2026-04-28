/**
 * AdQualityScore — Barra de progresso 0–100% do anúncio.
 *
 * Exibe o que falta para atingir o selo "Anúncio Padrão Ouro"
 * (jamais utilizar "Verificado" ou "Garantido").
 */

import { Award, Check, Circle } from 'lucide-react';
import { computeAdScore, type AdScoreInput } from '@/lib/serviceQualityLinter';

export const AdQualityScore = (props: AdScoreInput) => {
  const { score, breakdown, isPadrãoOuro } = computeAdScore(props);

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Award className={`h-4 w-4 ${isPadrãoOuro ? 'text-amber-500' : 'text-muted-foreground'}`} />
          <span className="text-xs font-semibold text-foreground">
            {isPadrãoOuro ? 'Anúncio Padrão Ouro' : 'Qualidade do anúncio'}
          </span>
        </div>
        <span className={`text-xs font-bold ${score >= 100 ? 'text-amber-600' : score >= 70 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
          {score}%
        </span>
      </div>

      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full transition-all ${
            score >= 100
              ? 'bg-gradient-to-r from-amber-400 to-amber-600'
              : score >= 70
              ? 'bg-emerald-500'
              : 'bg-accent'
          }`}
          style={{ width: `${score}%` }}
        />
      </div>

      <ul className="grid gap-1 pt-1">
        {breakdown.map((b) => (
          <li key={b.label} className="flex items-center gap-1.5 text-[11px]">
            {b.reached ? (
              <Check className="h-3 w-3 text-emerald-600" />
            ) : (
              <Circle className="h-3 w-3 text-muted-foreground" />
            )}
            <span className={b.reached ? 'text-foreground' : 'text-muted-foreground'}>
              {b.label}
            </span>
            <span className="ml-auto text-muted-foreground">+{b.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AdQualityScore;
