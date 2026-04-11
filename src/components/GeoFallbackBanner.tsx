import { MapPin, ArrowRight, Search, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  originalCity: string;
  expansionLevel: 'state' | 'all';
  stateName?: string;
  resultCount: number;
  onClearCity?: () => void;
  radiusKm?: number;
  onExpandRadius?: (km: number) => void;
}

const GeoFallbackBanner = ({ originalCity, expansionLevel, stateName, resultCount, onClearCity, radiusKm, onExpandRadius }: Props) => {
  const levelText =
    expansionLevel === 'state'
      ? `no estado${stateName ? ` de ${stateName}` : ''}`
      : 'em todo o Brasil';

  const title = radiusKm
    ? `Não encontramos resultados em até ${radiusKm} km de ${originalCity}`
    : `Não encontramos resultados em ${originalCity}`;

  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-900">{title}</p>
          <p className="mt-1 text-sm text-amber-800">
            Exibindo <span className="font-bold">{resultCount}</span> resultado(s) {levelText}. Esses profissionais são de outras regiões e podem não atender sua localidade.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {onExpandRadius && radiusKm && radiusKm < 50 && (
              <Button
                variant="outline"
                size="sm"
                className="border-amber-400 bg-white text-amber-800 hover:bg-amber-100"
                onClick={() => onExpandRadius(50)}
              >
                <Search className="mr-1 h-3.5 w-3.5" /> Ampliar para 50 km
              </Button>
            )}
            {onClearCity && (
              <Button
                variant="outline"
                size="sm"
                className="border-amber-400 bg-white text-amber-800 hover:bg-amber-100"
                onClick={onClearCity}
              >
                Ver todos os resultados <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeoFallbackBanner;
