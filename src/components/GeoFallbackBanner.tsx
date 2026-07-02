import { MapPin, ArrowRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  originalCity: string;
  expansionLevel: 'state' | 'all';
  stateName?: string;
  resultCount: number;
  onClearCity?: () => void;
  radiusKm?: number;
  onExpandRadius?: (km: number) => void;
  nearestDistanceKm?: number;
  nearestCity?: string;
}

const GeoFallbackBanner = ({ originalCity, expansionLevel, stateName, resultCount, onClearCity, radiusKm, onExpandRadius, nearestDistanceKm, nearestCity }: Props) => {
  const hasNearby = nearestDistanceKm != null && nearestDistanceKm < Infinity;

  const title = hasNearby && nearestCity
    ? `Não encontramos profissionais em ${originalCity}, mas encontramos em cidades próximas!`
    : `Não encontramos profissionais em ${originalCity}, mas encontramos em outras cidades!`;

  const subtitle = hasNearby && nearestCity
    ? `O mais próximo está a apenas ${Math.round(nearestDistanceKm)} km, em ${nearestCity}. Gostaria de ver?`
    : `Encontramos ${resultCount} profissional(is) em cidades vizinhas. Gostaria de ver?`;

  return (
    <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-start gap-3">
        <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-blue-900">{title}</p>
          <p className="mt-1 text-sm text-blue-800">{subtitle}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {onExpandRadius && radiusKm && radiusKm < 50 && (
              <Button
                variant="outline"
                size="sm"
                className="border-blue-300 bg-white text-blue-800 hover:bg-blue-100"
                onClick={() => onExpandRadius(50)}
              >
                <Search className="mr-1 h-3.5 w-3.5" /> Ampliar para 50 km
              </Button>
            )}
            {onClearCity && (
              <Button
                variant="default"
                size="sm"
                onClick={onClearCity}
              >
                Ver profissionais próximos <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeoFallbackBanner;
