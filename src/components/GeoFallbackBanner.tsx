import { MapPin, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  originalCity: string;
  expansionLevel: 'state' | 'all';
  stateName?: string;
  resultCount: number;
  onClearCity?: () => void;
}

const GeoFallbackBanner = ({ originalCity, expansionLevel, stateName, resultCount, onClearCity }: Props) => {
  const levelText =
    expansionLevel === 'state'
      ? `no estado${stateName ? ` de ${stateName}` : ''}`
      : 'em todo o Brasil';

  return (
    <div className="mb-4 rounded-xl border border-accent/20 bg-accent/5 p-4">
      <div className="flex items-start gap-3">
        <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            Não encontramos resultados em {originalCity}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Exibindo <span className="font-medium text-foreground">{resultCount}</span> resultado(s) {levelText} que podem atender sua região.
          </p>
          {onClearCity && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={onClearCity}
            >
              Ver todos os resultados <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GeoFallbackBanner;
