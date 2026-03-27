import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSearchSuggestions } from '@/hooks/useProviders';
import { useGeoCity } from '@/hooks/useGeoCity';

interface SearchBarProps {
  variant?: 'hero' | 'compact';
}

interface Suggestion {
  label: string;
  type: 'category' | 'city' | 'service';
  icon?: string;
  slug?: string;
  extra?: string;
}

const SearchBar = ({ variant = 'hero' }: SearchBarProps) => {
  const { city: geoCity } = useGeoCity();
  const [service, setService] = useState('');
  const [location, setLocation] = useState('');
  const [activeField, setActiveField] = useState<'service' | 'location' | null>(null);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const navigate = useNavigate();
  const serviceRef = useRef<HTMLInputElement>(null);
  const locationRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { data: suggestions } = useSearchSuggestions();

  const servicePlaceholder = geoCity ? `Preciso de um... em ${geoCity}` : 'Preciso de um...';
  const locationPlaceholder = geoCity ? geoCity : 'Cidade ou região';

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setActiveField(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const serviceSuggestions = useMemo((): Suggestion[] => {
    if (!suggestions || !service.trim()) return [];
    const q = service.toLowerCase();
    const results: Suggestion[] = [];

    suggestions.categories
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 4)
      .forEach((c) => results.push({ label: c.name, type: 'category', icon: c.icon, slug: c.slug }));

    suggestions.services
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, 4)
      .forEach((s) => results.push({ label: s.name, type: 'service', extra: s.category_name, slug: s.slug }));

    return results.slice(0, 6);
  }, [service, suggestions]);

  const locationSuggestions = useMemo((): Suggestion[] => {
    if (!suggestions || !location.trim()) return [];
    const q = location.toLowerCase();
    return suggestions.cities
      .filter((c) => c.name.toLowerCase().includes(q) || c.state.toLowerCase().includes(q))
      .slice(0, 6)
      .map((c) => ({ label: c.name, type: 'city' as const, extra: c.state, slug: c.slug }));
  }, [location, suggestions]);

  const activeSuggestions = activeField === 'service' ? serviceSuggestions : activeField === 'location' ? locationSuggestions : [];

  const [searchError, setSearchError] = useState('');

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    setActiveField(null);
    if (!service.trim() && !location.trim()) {
      setSearchError('Digite o que você precisa ou uma cidade');
      serviceRef.current?.focus();
      return;
    }
    setSearchError('');
    const params = new URLSearchParams();
    if (service) params.set('q', service);
    // Use typed location, or fallback to geo city
    const finalLocation = location.trim() || geoCity || '';
    if (finalLocation) params.set('cidade', finalLocation);
    navigate(`/buscar?${params.toString()}`);
  };

  const handleSelectSuggestion = (s: Suggestion) => {
    if (activeField === 'service') {
      setService(s.label);
      setActiveField(null);
      // Focus location if empty
      if (!location && variant === 'hero') {
        setTimeout(() => locationRef.current?.focus(), 100);
      } else {
        // Navigate directly
        const params = new URLSearchParams();
        params.set('q', s.label);
        if (location) params.set('cidade', location);
        navigate(`/buscar?${params.toString()}`);
      }
    } else if (activeField === 'location') {
      setLocation(s.label);
      setActiveField(null);
      const params = new URLSearchParams();
      if (service) params.set('q', service);
      params.set('cidade', s.label);
      navigate(`/buscar?${params.toString()}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (activeSuggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((prev) => Math.min(prev + 1, activeSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && highlightIdx >= 0) {
      e.preventDefault();
      handleSelectSuggestion(activeSuggestions[highlightIdx]);
    } else if (e.key === 'Escape') {
      setActiveField(null);
    }
  };

  // Reset highlight when suggestions change
  useEffect(() => setHighlightIdx(-1), [activeSuggestions.length]);

  const typeLabel: Record<string, string> = { category: 'Categoria', service: 'Serviço', city: 'Cidade' };

  const SuggestionsDropdown = () => {
    if (activeSuggestions.length === 0) return null;
    return (
      <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
        {activeSuggestions.map((s, i) => (
          <button
            key={`${s.type}-${s.label}`}
            type="button"
            className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted ${
              i === highlightIdx ? 'bg-muted' : ''
            }`}
            onMouseDown={(e) => {
              e.preventDefault();
              handleSelectSuggestion(s);
            }}
          >
            {s.type === 'city' ? (
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <span className="text-base">{s.icon || '🔧'}</span>
            )}
            <div className="min-w-0 flex-1">
              <span className="font-medium text-foreground">{s.label}</span>
              {s.extra && <span className="ml-2 text-xs text-muted-foreground">{s.extra}</span>}
            </div>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {typeLabel[s.type]}
            </span>
          </button>
        ))}
      </div>
    );
  };

  if (variant === 'compact') {
    return (
      <div ref={wrapperRef} className="relative">
        <form onSubmit={handleSearch} className={`flex items-center gap-2 rounded-lg border bg-card p-1.5 ${searchError ? 'border-destructive' : 'border-border'}`}>
          <div className="flex flex-1 items-center gap-2 px-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              ref={serviceRef}
              type="text"
              placeholder={servicePlaceholder}
              value={service}
              onChange={(e) => { setService(e.target.value); setSearchError(''); }}
              onFocus={() => setActiveField('service')}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            {service && (
              <button type="button" onClick={() => setService('')} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button type="submit" variant="accent" size="sm">Buscar</Button>
        </form>
        {searchError && <p className="mt-1 text-xs text-destructive">{searchError}</p>}
        <SuggestionsDropdown />
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative w-full max-w-2xl">
      <form onSubmit={handleSearch}>
        <div className="flex flex-col gap-3 rounded-2xl bg-card p-3 shadow-card-hover sm:flex-row sm:items-center sm:gap-0 sm:rounded-full sm:p-2">
          <div className="relative flex flex-1 items-center gap-2 px-4">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
            <input
              ref={serviceRef}
              type="text"
              placeholder={servicePlaceholder}
              value={service}
              onChange={(e) => { setService(e.target.value); setSearchError(''); }}
              onFocus={() => setActiveField('service')}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent text-foreground placeholder:text-muted-foreground outline-none"
            />
            {service && (
              <button type="button" onClick={() => setService('')} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="hidden h-8 w-px bg-border sm:block" />
          <div className="relative flex flex-1 items-center gap-2 px-4">
            <MapPin className="h-5 w-5 shrink-0 text-muted-foreground" />
            <input
              ref={locationRef}
              type="text"
              placeholder={locationPlaceholder}
              value={location}
              onChange={(e) => { setLocation(e.target.value); setSearchError(''); }}
              onFocus={() => setActiveField('location')}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent text-foreground placeholder:text-muted-foreground outline-none"
            />
            {location && (
              <button type="button" onClick={() => setLocation('')} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button type="submit" variant="hero" size="lg" className="rounded-full sm:rounded-full">
            Buscar
          </Button>
        </div>
      </form>
      {searchError && <p className="mt-2 text-center text-xs text-destructive">{searchError}</p>}
      <SuggestionsDropdown />
    </div>
  );
};

export default SearchBar;
