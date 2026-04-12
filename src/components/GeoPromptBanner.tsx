import { MapPin, Navigation, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGeoCity } from '@/hooks/useGeoCity';
import { motion } from 'framer-motion';

interface GeoPromptBannerProps {
  /** Show radius info even when GPS is active */
  showRadius?: boolean;
}

const GeoPromptBanner = ({ showRadius = true }: GeoPromptBannerProps) => {
  const { city, latitude, longitude, radiusKm, precise, requestPreciseLocation } = useGeoCity();

  const hasGps = latitude != null && longitude != null;
  const hasCity = !!city;

  // GPS active — show radius indicator
  if (hasGps && hasCity && showRadius) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 flex flex-col gap-1.5 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm"
      >
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-primary shrink-0" />
          <span className="text-foreground">
            📍 Buscando profissionais a até <strong>{radiusKm}km</strong> de{' '}
            <strong>{city}</strong>
          </span>
          {precise ? (
            <span className="ml-auto text-[10px] font-medium text-primary/60 uppercase tracking-wider">GPS Preciso</span>
          ) : (
            <span className="ml-auto text-[10px] font-medium text-amber-600/80 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Ref. aproximada
            </span>
          )}
        </div>
        {!precise && (
          <p className="text-[11px] text-muted-foreground leading-tight pl-6">
            A ordenação por distância pode ter variações. Ative o GPS para resultados mais precisos.
          </p>
        )}
      </motion.div>
    );
  }

  // City detected by IP but no GPS coords
  if (hasCity && !hasGps) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 flex flex-col gap-2 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 sm:flex-row sm:items-center"
      >
        <div className="flex items-center gap-2 flex-1 text-sm">
          <MapPin className="h-4 w-4 text-accent shrink-0" />
          <span className="text-foreground">
            Detectamos você em <strong>{city}</strong>. Ative o GPS para resultados mais precisos por distância.
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0"
          onClick={() => requestPreciseLocation()}
        >
          <Navigation className="h-3.5 w-3.5" />
          Ativar GPS
        </Button>
      </motion.div>
    );
  }

  // No city, no GPS — strong warning
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 sm:flex-row sm:items-center"
    >
      <div className="flex items-center gap-2 flex-1 text-sm">
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
        <span className="text-foreground">
          ⚠️ Resultados sem filtro de localização — ative o GPS para ver profissionais perto de você.
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10"
        onClick={() => requestPreciseLocation()}
      >
        <Navigation className="h-3.5 w-3.5" />
        Ativar localização
      </Button>
    </motion.div>
  );
};

export default GeoPromptBanner;
