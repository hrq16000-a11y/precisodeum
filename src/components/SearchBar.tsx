import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Sparkles, TrendingUp, MapPin, Wrench, Grid3X3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CategoryIcon from '@/components/CategoryIcon';
import { useSearchSuggestions } from '@/hooks/useProviders';
import { useGeoCity } from '@/hooks/useGeoCity';
import { useTypingPlaceholder } from '@/hooks/useTypingPlaceholder';

interface SearchBarProps {
  variant?: 'hero' | 'compact';
}

interface Suggestion {
  label: string;
  type: 'category' | 'city' | 'service' | 'popular';
  icon?: string;
  slug?: string;
  extra?: string;
}

const GEO_ASKED_KEY = 'geo_browser_asked';

const TRENDING_QUERIES = [
  'Eletricista',
  'Encanador',
  'Diarista',
  'Pintor',
  'Pedreiro',
  'Marceneiro',
];

// Fisher-Yates shuffle
const shuffleArray = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const badgeColors: Record<string, string> = {
  popular: 'bg-accent/15 text-accent',
  category: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  service: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  city: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
};

const SearchBar = ({ variant = 'hero' }: SearchBarProps) => {
  const { city: geoCity, setCity, latitude, longitude, radiusKm } = useGeoCity();
  const hasGps = latitude != null && longitude != null;
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [openCount, setOpenCount] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { data: suggestions } = useSearchSuggestions();
  const typingPlaceholder = useTypingPlaceholder(geoCity, !isFocused && !query.trim());

  // Request browser geolocation on first focus
  const requestGeoOnce = useCallback(() => {
    try {
      if (sessionStorage.getItem(GEO_ASKED_KEY)) return;
      if (!navigator.geolocation) return;
      sessionStorage.setItem(GEO_ASKED_KEY, '1');
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const r = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&localityLanguage=pt`
            );
            if (!r.ok) return;
            const d = await r.json();
            const city = d?.city || d?.locality || null;
            const state = d?.principalSubdivision || null;
            if (city) setCity(city, state || undefined);
          } catch { /* silent */ }
        },
        () => {},
        { timeout: 8000 }
      );
    } catch { /* silent */ }
  }, [setCity]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler, { passive: true });

    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, []);

  // Build suggestions based on query
  const filteredSuggestions = useMemo((): Suggestion[] => {
    if (!suggestions) return [];
    const q = query.trim().toLowerCase();

    // If no query, show trending
    if (!q) {
      const trending: Suggestion[] = TRENDING_QUERIES.map(label => {
        const cat = suggestions.categories.find(c => c.name.toLowerCase() === label.toLowerCase());
        return {
          label,
          type: 'popular' as const,
          icon: cat?.icon || '🔥',
          slug: cat?.slug,
        };
      });
      return shuffleArray(trending);
    }

    const results: Suggestion[] = [];

    // Match categories
    suggestions.categories
      .filter(c => c.name.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach(c => results.push({ label: c.name, type: 'category', icon: c.icon, slug: c.slug }));

    // Match popular services
    suggestions.services
      .filter(s => s.name.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach(s => results.push({ label: s.name, type: 'service', extra: s.category_name, slug: s.slug }));

    // Match cities (secondary)
    suggestions.cities
      .filter(c => c.name.toLowerCase().includes(q) || c.state.toLowerCase().includes(q))
      .slice(0, 2)
      .forEach(c => results.push({ label: c.name, type: 'city', extra: c.state, slug: c.slug }));

    return results.slice(0, 7);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, suggestions, openCount]);

  const [searchError, setSearchError] = useState('');

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsOpen(false);
    if (!query.trim()) {
      setSearchError('Digite o que você precisa');
      inputRef.current?.focus();
      return;
    }
    setSearchError('');
    const params = new URLSearchParams();
    params.set('q', query);
    if (geoCity) params.set('cidade', geoCity);
    navigate(`/buscar?${params.toString()}`);
  };

  const handleSelectSuggestion = (s: Suggestion) => {
    setIsOpen(false);
    setQuery(s.label);
    const params = new URLSearchParams();
    params.set('q', s.label);
    if (geoCity) params.set('cidade', geoCity);
    navigate(`/buscar?${params.toString()}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || filteredSuggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(prev => Math.min(prev + 1, filteredSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && highlightIdx >= 0) {
      e.preventDefault();
      handleSelectSuggestion(filteredSuggestions[highlightIdx]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  useEffect(() => setHighlightIdx(-1), [filteredSuggestions.length]);

  const handleFocus = () => {
    setIsFocused(true);
    setIsOpen(true);
    setOpenCount(c => c + 1);
    requestGeoOnce();
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'category': return <Grid3X3 className="h-3.5 w-3.5" />;
      case 'service': return <Wrench className="h-3.5 w-3.5" />;
      case 'city': return <MapPin className="h-3.5 w-3.5" />;
      case 'popular': return <TrendingUp className="h-3.5 w-3.5" />;
      default: return null;
    }
  };

  const typeLabel: Record<string, string> = {
    category: 'Categoria',
    service: 'Serviço',
    city: 'Cidade',
    popular: 'Popular',
  };

  const hasQuery = query.trim().length > 0;

  const suggestionsDropdown = isOpen && filteredSuggestions.length > 0 ? (
    <div
      className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-[50vh] overflow-y-auto overscroll-contain rounded-xl border border-border/60 bg-background/95 backdrop-blur-xl shadow-2xl isolate touch-pan-y animate-scale-in"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {!hasQuery && (
        <div className="flex items-center gap-2 border-b border-border/40 px-4 py-2.5">
          <Sparkles className="h-3.5 w-3.5 text-accent animate-pulse" />
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Buscas em alta</span>
        </div>
      )}
      <div className="py-1">
        {filteredSuggestions.map((s, i) => (
          <button
            key={`${s.type}-${s.label}-${i}`}
            type="button"
            className={`suggestion-item flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-all duration-200 hover:bg-accent/5 hover:scale-[1.01] active:scale-[0.99] ${
              i === highlightIdx ? 'bg-accent/8' : ''
            }`}
            style={{
              animation: 'suggestion-slide-in 0.35s ease-out forwards',
              animationDelay: `${i * 60}ms`,
              opacity: 0,
            }}
            onClick={() => handleSelectSuggestion(s)}
            onMouseEnter={() => setHighlightIdx(i)}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent/10 to-primary/10 text-sm shadow-sm ring-1 ring-accent/10 transition-transform duration-200 group-hover:scale-110">
              <CategoryIcon icon={s.icon || ''} size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-foreground">{s.label}</span>
              {s.extra && <span className="block truncate text-xs text-muted-foreground/80">{s.extra}</span>}
            </div>
            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${badgeColors[s.type] || 'bg-muted text-muted-foreground'}`}>
              {typeIcon(s.type)}
              {typeLabel[s.type]}
            </span>
          </button>
        ))}
      </div>
      {hasQuery && (
        <button
          type="button"
          className="flex w-full items-center gap-2 border-t border-border/40 px-4 py-3 text-sm font-semibold text-accent transition-all duration-200 hover:bg-accent/5"
          style={{
            animation: 'suggestion-slide-in 0.35s ease-out forwards',
            animationDelay: `${filteredSuggestions.length * 60}ms`,
            opacity: 0,
          }}
          onClick={() => handleSearch()}
        >
          <Search className="h-4 w-4" />
          Buscar por "{query}"
        </button>
      )}
    </div>
  ) : null;

  if (variant === 'compact') {
    return (
      <div ref={wrapperRef} className="relative">
        <form onSubmit={handleSearch} className={`flex items-center gap-2 rounded-xl border bg-card p-1.5 transition-all ${searchError ? 'border-destructive' : isFocused ? 'border-accent/50 shadow-md' : 'border-border'}`}>
          <div className="flex flex-1 flex-wrap items-center gap-2 px-2">
            <Search className={`h-4 w-4 transition-colors ${isFocused ? 'text-accent' : 'text-muted-foreground'}`} />
            <input
              ref={inputRef}
              type="text"
              placeholder={typingPlaceholder || "O que você precisa?"}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSearchError(''); setIsOpen(true); }}
              onFocus={handleFocus}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              autoComplete="off"
            />
            {query && (
              <button type="button" onClick={() => { setQuery(''); inputRef.current?.focus(); }} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button type="submit" variant="accent" size="sm">Buscar</Button>
        </form>
        {searchError && <p className="mt-1 text-xs text-destructive">{searchError}</p>}
        {hasGps && geoCity && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3 text-primary" />
            <span>📍 {geoCity} · {radiusKm}km</span>
          </div>
        )}
        {suggestionsDropdown}
      </div>
    );
  }

  return (
      <div ref={wrapperRef} className="relative z-40 w-full max-w-xl">
        <form onSubmit={handleSearch}>
          <div
            className={`flex items-center gap-2 rounded-full bg-card p-2 pl-5 transition-all duration-300 ${
              isFocused
                ? 'shadow-lg ring-2 ring-accent/20'
                : 'shadow-card-hover'
            }`}
          >
            <Search className={`h-5 w-5 shrink-0 transition-colors duration-200 ${isFocused ? 'text-accent' : 'text-muted-foreground'}`} />
            <input
              ref={inputRef}
              type="text"
              placeholder={typingPlaceholder || "O que você precisa? Ex: eletricista, pintor..."}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSearchError(''); setIsOpen(true); }}
              onFocus={handleFocus}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              className="min-w-0 flex-1 bg-transparent text-foreground placeholder:text-muted-foreground/60 outline-none"
              autoComplete="off"
            />
            {query && (
              <button type="button" onClick={() => { setQuery(''); inputRef.current?.focus(); }} className="mr-1 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
            <Button type="submit" variant="hero" size="lg" className="rounded-full px-6">
              Buscar
            </Button>
          </div>
        </form>
        {searchError && <p className="mt-2 text-center text-xs text-destructive">{searchError}</p>}
        {suggestionsDropdown}
      </div>
  );
};

export default SearchBar;
