import { MapPin, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  originalCity: string;
  expansionLevel: 'state' | 'all';
  stateName?: string;
  resultCount: number;
  onClearCity?: () => void;
  radiusKm?: number;
}

const GeoFallbackBanner = ({ originalCity, expansionLevel, stateName, resultCount, onClearCity, radiusKm }: Props) => {
  const levelText =
    expansionLevel === 'state'
      ? `no estado${stateName ? ` de ${stateName}` : ''}`
      : 'em todo o Brasil';

  const title = radiusKm
    ? `Não encontramos resultados em até ${radiusKm} km de ${originalCity}`
    : `Não encontramos resultados em ${originalCity}`;

  const description = radiusKm
    ? `Exibindo ${resultCount} resultado(s) ${levelText}. Esses profissionais estão fora do raio próximo e podem atender regiões mais distantes.`
    : `Exibindo ${resultCount} resultado(s) ${levelText}. Esses profissionais são de outras regiões e podem não atender sua localidade.`;

  return (
    <div className="mb-4 rounded-xl border border-accent/20 bg-accent/5 p-4">
      <div className="flex items-start gap-3">
        <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Exibindo <span className="font-medium text-foreground">{resultCount}</span> resultado(s) {radiusKm ? levelText.replace(/^em /, '') : levelText}. {radiusKm ? 'Esses profissionais estão fora do raio próximo e podem atender regiões mais distantes.' : 'Esses profissionais são de outras regiões e podem não atender sua localidade.'}
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
