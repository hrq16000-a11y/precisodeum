import { useGeoCity } from '@/hooks/useGeoCity';
import { useOnlineCountByCity } from '@/hooks/useOnlinePresence';
import AnimatedCounter from '@/components/ui/AnimatedCounter';

const ActiveProvidersCounter = () => {
  const { city: geoCity } = useGeoCity();
  const count = useOnlineCountByCity(geoCity);

  // Always render with fixed height to prevent CLS
  const cityLabel = geoCity || 'na plataforma';

  // Render a fixed-height container regardless of count to prevent CLS
  // when the counter appears/disappears after async data loads.
  return (
    <div className="container" style={{ minHeight: 52 }}>
      <div className="py-3" style={{ visibility: count && count > 0 ? 'visible' : 'hidden' }}>
        <div className="flex items-center justify-center gap-2 rounded-xl bg-accent/5 border border-accent/10 px-4 py-3 text-sm">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-muted-foreground">
            <AnimatedCounter value={count || 0} className="font-bold text-foreground" />{' '}
            profissionais online agora em{' '}
            <span className="font-semibold text-foreground">{cityLabel}</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default ActiveProvidersCounter;
