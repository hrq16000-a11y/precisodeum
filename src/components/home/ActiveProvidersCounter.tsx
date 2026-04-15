import { useGeoCity } from '@/hooks/useGeoCity';
import { useOnlineCountByCity } from '@/hooks/useOnlinePresence';
import AnimatedCounter from '@/components/ui/AnimatedCounter';

const ActiveProvidersCounter = () => {
  const { city: geoCity } = useGeoCity();
  const count = useOnlineCountByCity(geoCity);

  // Always render with fixed height to prevent CLS
  const cityLabel = geoCity || 'na plataforma';

  return (
    <div className="container" style={{ minHeight: 52 }}>
      {count && count > 0 ? (
        <div className="py-3 animate-fade-in">
          <div className="flex items-center justify-center gap-2 rounded-xl bg-accent/5 border border-accent/10 px-4 py-3 text-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-muted-foreground">
              <AnimatedCounter value={count} className="font-bold text-foreground" />{' '}
              {count === 1 ? 'profissional online' : 'profissionais online'} agora em{' '}
              <span className="font-semibold text-foreground">{cityLabel}</span>
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ActiveProvidersCounter;
