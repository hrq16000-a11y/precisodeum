import { Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { computeProviderScore, type SearchScoreWeights } from '@/lib/searchFilters';

/**
 * Badge sobreposto ao card do profissional na ordenação "Melhor combinação".
 * Mostra um tooltip explicando como o score é calculado (rating + distância
 * ponderados pelos pesos vindos de `site_settings.search_score_weights`).
 */
interface Props {
  rating: number;
  reviewCount: number;
  distanceKm?: number | null;
  weights: SearchScoreWeights;
}

export function ScoreTooltipBadge({ rating, reviewCount, distanceKm, weights }: Props) {
  const score = computeProviderScore({ rating, distanceKm }, weights);
  const pct = Math.round(score * 100);
  const wrPct = Math.round((weights.rating / (weights.rating + weights.distance || 1)) * 100);
  const wdPct = 100 - wrPct;
  const distLabel =
    distanceKm == null
      ? 'sem GPS'
      : distanceKm < 1
        ? `${Math.round(distanceKm * 1000)} m`
        : `${distanceKm.toFixed(1)} km`;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Score combinado ${pct} de 100 — toque para ver explicação`}
            className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-primary/95 px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-xs backdrop-blur-xs hover:bg-primary"
            onClick={(e) => e.stopPropagation()}
          >
            <Sparkles className="h-3 w-3" strokeWidth={2} />
            {pct}
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-[240px] text-xs leading-relaxed">
          <p className="mb-1 font-semibold">Melhor combinação · {pct}/100</p>
          <p className="text-muted-foreground">
            Avaliação <strong className="text-foreground">{rating.toFixed(1)}</strong>{' '}
            ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}) · peso {wrPct}%
          </p>
          <p className="text-muted-foreground">
            Distância <strong className="text-foreground">{distLabel}</strong> · peso {wdPct}%
          </p>
          <p className="mt-1 text-muted-foreground">
            Rating tem prioridade; distância funciona como desempate.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default ScoreTooltipBadge;
