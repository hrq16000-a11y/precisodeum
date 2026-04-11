import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { MapPin, ChevronDown, Check, Loader2, LocateFixed, SlidersHorizontal } from 'lucide-react';
import { useGeoCity } from '@/hooks/useGeoCity';
import { supabase } from '@/integrations/supabase/client';
import { calculateDistanceKm } from '@/lib/geoDistance';
import { normalize } from '@/lib/geoUtils';

interface GeoLocationChipProps {
  variant?: 'default' | 'hero';
}

interface CityRow {
  name: string;
  state_uf: string | null;
  state: string;
  latitude: number | null;
  longitude: number | null;
  has_providers: boolean;
  provider_count: number;
}

const RADIUS_OPTIONS = [5, 10, 30, 50, 100];

const GeoLocationChip = ({ variant = 'default' }: GeoLocationChipProps) => {
  const { city, state, latitude, longitude, radiusKm, setCity, setRadius } = useGeoCity();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [allCities, setAllCities] = useState<CityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      if (allCities.length === 0) {
        setLoading(true);
        supabase
          .from('cities')
          .select('name, state_uf, state, latitude, longitude, has_providers, provider_count')
          .order('provider_count', { ascending: false })
          .limit(500)
          .then(({ data }) => {
            setAllCities((data as CityRow[]) || []);
            setLoading(false);
          });
      }
    }
  }, [open]);

  const displayText = city ? `${city}${state ? `, ${state}` : ''}` : 'Definir localização';

  const filteredCities = useMemo(() => {
    const hasGps = latitude != null && longitude != null;

    let list = allCities;

    // When searching, filter by text
    if (search.trim()) {
      const q = normalize(search);
      const terms = q.split(/\s+/).filter(Boolean);
      list = allCities.filter((c) => {
        const cityNorm = normalize(c.name);
        const stateNorm = normalize(c.state_uf || c.state);
        return terms.every((t) => cityNorm.includes(t) || stateNorm.includes(t));
      });
    }

    // Calculate distances and sort by proximity when GPS available
    if (hasGps) {
      const withDist = list.map((c) => {
        const dist = c.latitude != null && c.longitude != null
          ? calculateDistanceKm(
              { latitude: latitude!, longitude: longitude! },
              { latitude: c.latitude, longitude: c.longitude }
            )
          : null;
        return { ...c, _dist: dist };
      });

      // Sort: cities with coords by distance, then cities without coords
      withDist.sort((a, b) => {
        if (a._dist != null && b._dist != null) return a._dist - b._dist;
        if (a._dist != null) return -1;
        if (b._dist != null) return 1;
        return 0;
      });

      return withDist.slice(0, 15);
    }

    // No GPS — show by provider count (already sorted), limit
    return list.slice(0, 15).map((c) => ({ ...c, _dist: null as number | null }));
  }, [search, allCities, latitude, longitude]);

  const handleAutoLocate = async () => {
    setLocating(true);
    try {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            try {
              const response = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=pt`
              );
              const data = await response.json();
              const detectedCity = data?.city || data?.locality || '';
              const detectedState = data?.principalSubdivision || '';
              if (detectedCity) {
                setCity(detectedCity, detectedState, lat, lon);
              }
            } catch {
              // Fallback: keep coordinates even without city name
            }
            setLocating(false);
            setOpen(false);
          },
          () => setLocating(false),
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
        );
      } else {
        setLocating(false);
      }
    } catch {
      setLocating(false);
    }
  };

  const handleSelectCity = (c: CityRow & { _dist: number | null }) => {
    setCity(c.name, c.state_uf || c.state, c.latitude, c.longitude);
    setOpen(false);
    setSearch('');
  };

  const hasCoords = latitude !== null && longitude !== null;

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
          variant === 'hero'
            ? 'border border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground/90 hover:bg-primary-foreground/20'
            : 'border border-border bg-card text-foreground shadow-sm hover:bg-muted'
        }`}
      >
        <MapPin className={`h-3.5 w-3.5 ${variant === 'hero' ? 'text-secondary' : 'text-accent'}`} />
        <span className="max-w-[160px] truncate">{displayText}</span>
        {hasCoords && (
          <span className={`text-[10px] ${variant === 'hero' ? 'text-primary-foreground/50' : 'text-muted-foreground'}`}>
            {radiusKm}km
          </span>
        )}
        <ChevronDown className={`h-3 w-3 transition-transform ${variant === 'hero' ? 'text-primary-foreground/50' : 'text-muted-foreground'} ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          {/* Auto-locate */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              void handleAutoLocate();
            }}
            disabled={locating}
            className="flex w-full items-center gap-2.5 border-b border-border px-3 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/5 disabled:opacity-50"
          >
            {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
            {locating ? 'Detectando localização...' : 'Usar minha localização'}
          </button>

          {/* Radius selector */}
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">Raio:</span>
            <div className="flex flex-1 gap-1">
              {RADIUS_OPTIONS.map((km) => (
                <button
                  key={km}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setRadius(km);
                  }}
                  className={`flex-1 rounded-md px-1 py-1 text-[11px] font-semibold transition-colors ${
                    radiusKm === km
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-accent/10 hover:text-accent'
                  }`}
                >
                  {km}km
                </button>
              ))}
            </div>
          </div>

          {/* City search */}
          <div className="border-b border-border p-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="Buscar cidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>

          {/* City list */}
          <div className="max-h-48 overflow-y-auto p-1">
            {loading && (
              <div className="flex items-center justify-center gap-2 px-3 py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Carregando cidades...</span>
              </div>
            )}
            {!loading && filteredCities.length === 0 && search.trim() && (
              <p className="px-3 py-2 text-xs text-muted-foreground">Nenhuma cidade encontrada</p>
            )}
            {filteredCities.map((c, i) => {
              const uf = c.state_uf || c.state;
              const isSelected = city === c.name && state === uf;
              const distLabel = c._dist != null
                ? c._dist < 1 ? '< 1 km' : `${Math.round(c._dist)} km`
                : null;
              return (
                <button
                  key={`${c.name}-${uf}-${i}`}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectCity(c);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate font-medium text-foreground">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{uf}</span>
                  {distLabel && (
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      {distLabel}
                    </span>
                  )}
                  {isSelected && <Check className="h-3.5 w-3.5 text-accent" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default GeoLocationChip;
