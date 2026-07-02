import { useMemo } from 'react';
import { Zap } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useGeoCity } from '@/hooks/useGeoCity';
import { useOnlineUsersMap } from '@/hooks/useOnlinePresence';

interface Props {
  enabled: boolean;
  onToggle: (next: boolean) => void;
  /** Optional override of the city used to count matches; defaults to user's geo city */
  cityOverride?: string;
  variant?: 'hero' | 'inline';
  className?: string;
}

/**
 * "Preciso para hoje" — Modo Urgência.
 * Mostra apenas se houver ao menos 1 profissional online na região do usuário.
 * Ao ativar, sinaliza para o consumidor priorizar profissionais online agora.
 */
const UrgencyToggle = ({ enabled, onToggle, cityOverride, variant = 'inline', className = '' }: Props) => {
  const { city: geoCity } = useGeoCity();
  const city = (cityOverride ?? geoCity ?? '').trim();
  const onlineMap = useOnlineUsersMap();

  const onlineInCity = useMemo(() => {
    if (!city) return 0;
    const norm = city.toLowerCase();
    let count = 0;
    onlineMap.forEach((v) => {
      if (v.city && v.city.toLowerCase() === norm) count++;
    });
    return count;
  }, [onlineMap, city]);

  // Only render if there are online professionals in the region
  if (!city || onlineInCity === 0) return null;

  const isHero = variant === 'hero';

  return (
    <div
      className={`inline-flex items-center gap-2 sm:gap-3 rounded-full border ${
        isHero
          ? 'border-white/30 bg-black/30 backdrop-blur-md text-primary-foreground'
          : 'border-accent/30 bg-accent/5 text-foreground'
      } px-3 py-1.5 ${className}`}
      role="group"
      aria-label="Modo urgência"
    >
      <Zap
        className={`h-4 w-4 ${enabled ? 'text-amber-400 fill-amber-400/30' : isHero ? 'text-white/80' : 'text-muted-foreground'}`}
        aria-hidden
      />
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <span className="text-xs sm:text-sm font-semibold">Preciso para hoje</span>
        <Switch
          checked={enabled}
          onCheckedChange={onToggle}
          aria-label="Ativar modo urgência"
        />
      </label>
      <span
        className={`hidden sm:inline-flex items-center gap-1 rounded-full ${
          isHero ? 'bg-white/15 text-white' : 'bg-emerald-500/10 text-emerald-600'
        } px-2 py-0.5 text-[11px] font-bold`}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>
        {onlineInCity} prontos para atender agora
      </span>
    </div>
  );
};

export default UrgencyToggle;
