import { useState, useRef, useEffect } from 'react';
import { MapPin, ChevronDown, Check } from 'lucide-react';
import { useGeoCity } from '@/hooks/useGeoCity';
import { useSearchSuggestions } from '@/hooks/useProviders';

interface GeoLocationChipProps {
  variant?: 'default' | 'hero';
}

const GeoLocationChip = ({ variant = 'default' }: GeoLocationChipProps) => {
  const { city, state, setCity } = useGeoCity();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: suggestions } = useSearchSuggestions();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const displayText = city ? `${city}${state ? `, ${state}` : ''}` : 'Definir localização';

  const filteredCities = (suggestions?.cities || [])
    .filter((c) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.state.toLowerCase().includes(q);
    })
    .slice(0, 8);

  const handleSelect = (name: string, st: string) => {
    setCity(name, st);
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
        <div className="absolute left-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
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
          <div className="max-h-48 overflow-y-auto p-1">
            {filteredCities.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">Nenhuma cidade encontrada</p>
            )}
            {filteredCities.map((c) => (
              <button
                key={c.slug}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(c.name, c.state);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate font-medium text-foreground">{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.state}</span>
                {city === c.name && <Check className="h-3.5 w-3.5 text-accent" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GeoLocationChip;
