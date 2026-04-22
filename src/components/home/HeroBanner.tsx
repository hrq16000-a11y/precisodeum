import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { MapPin, Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import RotatingServiceText from '@/components/home/RotatingServiceText';
import UrgencyToggle from '@/components/home/UrgencyToggle';
import { useUrgencyMode } from '@/hooks/useUrgencyMode';
import { useGeoCity } from '@/hooks/useGeoCity';
import { useSettingValue } from '@/hooks/useSiteSettings';
import { importWithRetry } from '@/lib/lazyWithRetry';
import { getCategoryForService, CATEGORY_IMAGES } from '@/lib/serviceCategoryMap';
import { Icon } from '@/components/ui/Icon';

const SearchBar = lazy(() => importWithRetry(() => import('@/components/SearchBar')));

const FALLBACK_PREFIXES = ['Encontre o melhor', 'Preciso de'];

const CriticalHeroSearch = ({ onUpgrade }: { onUpgrade: () => void }) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    if (!value) {
      onUpgrade();
      return;
    }
    navigate(`/buscar?q=${encodeURIComponent(value)}`);
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full items-center gap-2 rounded-full bg-card pl-4 pr-1.5 py-1.5 shadow-card-hover">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={onUpgrade}
        placeholder="O que você precisa?"
        className="min-w-0 flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground/60 outline-none"
        autoComplete="off"
        inputMode="search"
      />
      <button
        type="submit"
        aria-label="Buscar profissional"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-md transition-transform active:scale-95"
      >
        <Icon icon={Search} className="h-5 w-5" />
      </button>
    </form>
  );
};

const HeroPrefixRotator = ({ prefixes, active }: { prefixes: string[]; active: boolean }) => {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'visible' | 'glitch' | 'hidden'>('visible');
  const startedAt = useRef(0);

  useEffect(() => {
    if (!active || prefixes.length <= 1) return;
    let frame = 0;
    let stage: 'visible' | 'glitch' | 'hidden' = 'visible';
    startedAt.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startedAt.current;
      if (elapsed >= 5350) {
        startedAt.current = now;
        stage = 'visible';
        setPhase('visible');
      } else if (elapsed >= 5200 && stage !== 'glitch') {
        stage = 'glitch';
        setPhase('glitch');
      } else if (elapsed >= 5100 && stage !== 'hidden') {
        stage = 'hidden';
        setPhase('hidden');
        setIndex(prev => (prev + 1) % prefixes.length);
      } else if (elapsed >= 5000 && stage !== 'glitch') {
        stage = 'glitch';
        setPhase('glitch');
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, prefixes.length]);

  return (
    <span className="relative inline-block overflow-hidden">
      <span
        className={`inline-block transition-all duration-150 ${
          phase === 'visible' ? 'opacity-100 translate-y-0' :
          phase === 'glitch' ? 'opacity-80 hero-glitch-flash' :
          'opacity-0 translate-y-1'
        }`}
      >
        {prefixes[index] || prefixes[0]}
      </span>
      {phase === 'glitch' && (
        <>
          <span className="pointer-events-none absolute inset-0 hero-scanline" />
          <span className="pointer-events-none absolute inset-0 hero-glitch-line" />
        </>
      )}
    </span>
  );
};

const HeroBanner = () => {
  const [displayedImage, setDisplayedImage] = useState(CATEGORY_IMAGES.instalacoes);
  const [nextImage, setNextImage] = useState<string | null>(null);
  const [heroImageLoaded, setHeroImageLoaded] = useState(false);
  const [enhancedSearch, setEnhancedSearch] = useState(false);
  const { city: geoCity } = useGeoCity();
  const { enabled: urgencyMode, setEnabled: setUrgencyMode } = useUrgencyMode();

  const prefixesRaw = useSettingValue('hero_prefixes');
  const ctaPrimaryLinkText = useSettingValue('hero_cta_primary_link_text');
  const ctaPrimaryLink = useSettingValue('hero_cta_primary_link');
  const ctaSecondaryText = useSettingValue('hero_cta_secondary_text');
  const ctaSecondaryLink = useSettingValue('hero_cta_secondary_link');

  const prefixes = useMemo(() => {
    if (!prefixesRaw) return FALLBACK_PREFIXES;
    const parsed = prefixesRaw.split(',').map(s => s.trim()).filter(Boolean);
    return parsed.length > 0 ? parsed : FALLBACK_PREFIXES;
  }, [prefixesRaw]);

  const handleServiceChange = useCallback((service: string) => {
    if (!heroImageLoaded) return;
    const cat = getCategoryForService(service);
    const newImg = CATEGORY_IMAGES[cat];
    if (newImg !== displayedImage) {
      setNextImage(newImg);
      const img = new Image();
      img.onload = () => {
        setDisplayedImage(newImg);
        setNextImage(null);
      };
      img.src = newImg;
    }
  }, [displayedImage, heroImageLoaded]);

  useEffect(() => {
    if (enhancedSearch) return;
    const onFirstInput = () => setEnhancedSearch(true);
    window.addEventListener('pointerdown', onFirstInput, { once: true, passive: true });
    window.addEventListener('keydown', onFirstInput, { once: true });
    return () => {
      window.removeEventListener('pointerdown', onFirstInput);
      window.removeEventListener('keydown', onFirstInput);
    };
  }, [enhancedSearch]);

  return (
    <section
      className="relative overflow-visible py-6 sm:py-8 md:overflow-hidden md:py-20"
      style={{ height: 340, minHeight: 340 }}
    >
      {/* Current background — dimensions explicit to prevent CLS */}
      <img
        src={displayedImage}
        alt="Profissionais de serviços"
        width={1920}
        height={768}
        fetchPriority="high"
        loading="eager"
        decoding="async"
        // @ts-expect-error - non-standard but supported by Chromium for LCP hinting
        elementtiming="hero-lcp"
        className="absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-700"
        style={{ width: '100%', height: '100%' }}
        onLoad={() => setHeroImageLoaded(true)}
      />

      {nextImage && (
        <img
          src={nextImage}
          alt=""
          width={1920}
          height={768}
          loading="eager"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-center animate-fade-in"
          style={{ animationDuration: '800ms', width: '100%', height: '100%' }}
        />
      )}

      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, hsl(var(--primary) / 0.85) 0%, hsl(var(--primary) / 0.7) 100%)`,
        }}
      />

      {/* Stronger bottom shadow gradient for legibility on mobile */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/40 via-black/15 to-transparent" />

      <div className="container relative z-10 flex flex-col items-center text-center hero-entrance">
        <div className="w-full max-w-full overflow-hidden px-4">
          <h1
            className="font-display text-2xl font-black tracking-tight text-primary-foreground sm:text-3xl md:text-5xl lg:text-6xl max-w-full overflow-hidden"
            style={{ textShadow: '0 2px 8px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.3)' }}
          >
            <HeroPrefixRotator prefixes={prefixes} active={heroImageLoaded} />
            <br />
            <RotatingServiceText onServiceChange={handleServiceChange} />
          </h1>
        </div>

        <div className="relative z-30 mt-4 w-full max-w-2xl md:mt-6 hero-search-wrapper">
          <div className="animate-glow-ring rounded-full">
            {enhancedSearch ? (
              <Suspense fallback={<CriticalHeroSearch onUpgrade={() => setEnhancedSearch(true)} />}>
                <SearchBar />
              </Suspense>
            ) : (
              <CriticalHeroSearch onUpgrade={() => setEnhancedSearch(true)} />
            )}
          </div>
          <div className="mt-3 flex min-h-[2.5rem] flex-col items-center justify-center gap-2 text-xs text-primary-foreground/70 sm:min-h-[1.25rem] sm:flex-row sm:gap-3">
            <span className="inline-flex items-center gap-2">
              <Icon icon={MapPin} className="h-3.5 w-3.5 text-secondary" />
              <span>{geoCity ? `Atendendo em ${geoCity} e região` : 'Profissionais próximos de você'}</span>
            </span>
            <UrgencyToggle
              enabled={urgencyMode}
              onToggle={setUrgencyMode}
              variant="hero"
            />
          </div>
        </div>

        <div className="relative z-10 mt-4 flex flex-col items-center gap-2 sm:flex-row sm:gap-4">
          <Link
            to={ctaPrimaryLink || '/cadastro'}
            className="inline-flex items-center justify-center rounded-full bg-secondary px-5 py-2.5 text-sm font-bold text-secondary-foreground shadow-md transition-transform hover:scale-105 active:scale-95 sm:bg-transparent sm:px-0 sm:py-0 sm:shadow-none sm:text-primary-foreground/80 sm:font-semibold sm:hover:underline sm:underline-offset-2"
          >
            {ctaPrimaryLinkText || 'Cadastrar agora →'}
          </Link>
          <span className="hidden text-primary-foreground/40 sm:inline">|</span>
          <p className="text-sm sm:text-base drop-shadow-lg">
            <Link to={ctaSecondaryLink || '/dashboard/vagas'} className="font-bold text-white hover:underline underline-offset-4" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}>
              {ctaSecondaryText || 'Cadastre uma vaga / oportunidade →'}
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
};

export default HeroBanner;
