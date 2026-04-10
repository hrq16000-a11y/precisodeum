import { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, ChevronDown, Check, Loader2 } from 'lucide-react';
import { useGeoCity } from '@/hooks/useGeoCity';

interface GeoLocationChipProps {
  variant?: 'default' | 'hero';
}

interface CityResult {
  name: string;
  state: string;
}

// IBGE API: all 5,570 Brazilian municipalities
let ibgeCachePromise: Promise<CityResult[]> | null = null;

function fetchAllMunicipalities(): Promise<CityResult[]> {
  if (ibgeCachePromise) return ibgeCachePromise;
  ibgeCachePromise = fetch(
    'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome'
  )
    .then((res) => {
      if (!res.ok) throw new Error('IBGE API error');
      return res.json();
    })
    .then((data: any[]) =>
      data
        .map((m) => ({
          name: (m.nome || '') as string,
          state: (m.microrregiao?.mesorregiao?.UF?.sigla || '') as string,
        }))
        .filter((c) => c.name && c.state)
    )
    .catch(() => {
      ibgeCachePromise = null;
      return [] as CityResult[];
    });
  return ibgeCachePromise;
}

let geocodeCache = new Map<string, { latitude: number | null; longitude: number | null }>();

async function geocodeCity(name: string, state: string) {
  const key = `${name}|${state}`;
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;

  const query = encodeURIComponent(`${name}, ${state}, Brasil`);
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${query}`);
    if (!res.ok) throw new Error('geocode failed');
    const data = await res.json();
    const result = {
      latitude: data?.[0]?.lat ? Number(data[0].lat) : null,
      longitude: data?.[0]?.lon ? Number(data[0].lon) : null,
    };
    geocodeCache.set(key, result);
    return result;
  } catch {
    const result = { latitude: null, longitude: null };
    geocodeCache.set(key, result);
    return result;
  }
}

// Normalize for accent-insensitive search
function normalize(s: string | undefined | null) {
  if (!s) return '';
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const GeoLocationChip = ({ variant = 'default' }: GeoLocationChipProps) => {
  const { city, state, setCity } = useGeoCity();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [allCities, setAllCities] = useState<CityResult[]>([]);
  const [loading, setLoading] = useState(false);
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
        fetchAllMunicipalities().then((cities) => {
          setAllCities(cities);
          setLoading(false);
        });
      }
    }
  }, [open]);

  const displayText = city ? `${city}${state ? `, ${state}` : ''}` : 'Definir localização';

  const filteredCities = useCallback(() => {
    if (!search.trim()) return allCities.slice(0, 12);
    const q = normalize(search);
    const terms = q.split(/\s+/).filter(Boolean);
    return allCities
      .filter((c) => {
        const cityNorm = normalize(c.name);
        const stateNorm = normalize(c.state);
        return terms.every((t) => cityNorm.includes(t) || stateNorm.includes(t));
      })
      .slice(0, 12);
  }, [search, allCities])();

  const handleSelect = async (name: string, st: string) => {
    const { latitude, longitude } = await geocodeCity(name, st);
    setCity(name, st, latitude, longitude);
    setOpen(false);
    setSearch('');
  };

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
        <ChevronDown className={`h-3 w-3 transition-transform ${variant === 'hero' ? 'text-primary-foreground/50' : 'text-muted-foreground'} ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <div className="border-b border-border p-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="Digite o nome da cidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {loading && (
              <div className="flex items-center justify-center gap-2 px-3 py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Carregando municípios...</span>
              </div>
            )}
            {!loading && filteredCities.length === 0 && search.trim() && (
              <p className="px-3 py-2 text-xs text-muted-foreground">Nenhuma cidade encontrada</p>
            )}
            {!loading && filteredCities.length === 0 && !search.trim() && allCities.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">Erro ao carregar cidades. Tente novamente.</p>
            )}
            {filteredCities.map((c, i) => (
              <button
                key={`${c.name}-${c.state}-${i}`}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  void handleSelect(c.name, c.state);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate font-medium text-foreground">{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.state}</span>
                {city === c.name && state === c.state && <Check className="h-3.5 w-3.5 text-accent" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GeoLocationChip;
