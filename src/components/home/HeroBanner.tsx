import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
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


type HeroPhraseInfo = { slug: string; label: string; prefix: 'need' | 'find' };

const HERO_WIDTHS = [640, 1280, 1920] as const;

/**
 * Monta o srcSet responsivo das variantes de hero geradas por
 * `scripts/generate-hero-variants.mjs` (`/hero-cat-<slug>-<width>.<ext>`).
 */
const heroSrcSet = (src: string, ext: 'avif' | 'webp'): string => {
  const base = src.replace(/\.(webp|jpg|jpeg|png)$/i, '');
  return HERO_WIDTHS.map((w) => `${base}-${w}.${ext} ${w}w`).join(', ');
};


const CriticalHeroSearch = ({
  onUpgrade,
  phraseRef,
}: {
  onUpgrade: () => void;
  phraseRef?: React.MutableRefObject<HeroPhraseInfo | null>;
}) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const trackCtaClick = (action: 'submit' | 'focus') => {
    const info = phraseRef?.current;
    if (!info) return;
    // Lazy import para não inflar o bundle crítico do hero
    import('@/lib/tracking').then(({ trackEvent }) => {
      trackEvent({
        event: 'hero_cta_click',
        slug: info.slug,
        source: 'hero_search',
        extra: {
          phrase_prefix: info.prefix,
          phrase_label: info.label,
          action,
        },
      });
    }).catch(() => { /* silent */ });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    trackCtaClick('submit');
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
        onFocus={() => { onUpgrade(); trackCtaClick('focus'); }}
        placeholder="O que você precisa?"
        className="min-w-0 flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground/60 outline-hidden"
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

// HeroPrefixRotator foi removido — a alternância de prefixos agora vive
// dentro de RotatingServiceText, encadeada com o nome do serviço para
// formar frases com nexo ("Preciso de um pintor" → "Encontre um pintor!").


const HeroBanner = () => {
  const [displayedImage, setDisplayedImage] = useState(CATEGORY_IMAGES.instalacoes);
  const [nextImage, setNextImage] = useState<string | null>(null);
  const [heroImageLoaded, setHeroImageLoaded] = useState(false);
  const [enhancedSearch, setEnhancedSearch] = useState(false);
  const { city: geoCity } = useGeoCity();
  const { enabled: urgencyMode, setEnabled: setUrgencyMode } = useUrgencyMode();

  const ctaPrimaryLinkText = useSettingValue('hero_cta_primary_link_text');
  const ctaPrimaryLink = useSettingValue('hero_cta_primary_link');
  const ctaSecondaryText = useSettingValue('hero_cta_secondary_text');
  const ctaSecondaryLink = useSettingValue('hero_cta_secondary_link');


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

  // Frase atual do rotator — guardada em ref para a CTA registrar analytics
  // sem causar re-render a cada troca (HOLD_MS = 2.6s).
  const phraseRef = useRef<HeroPhraseInfo | null>(null);
  const handlePhraseChange = useCallback((info: HeroPhraseInfo) => {
    phraseRef.current = info;
    import('@/lib/tracking').then(({ trackEvent }) => {
      trackEvent({
        event: 'hero_phrase_shown',
        slug: info.slug,
        source: 'hero_rotator',
        extra: { phrase_prefix: info.prefix, phrase_label: info.label },
      });
    }).catch(() => { /* silent */ });
  }, []);

  return (
    <section
      className="relative overflow-visible py-6 sm:py-8 md:overflow-hidden md:py-20 md:min-h-[520px] lg:min-h-[560px]"
      style={{ minHeight: 340 }}
    >

      {/* Current background — dimensões explícitas evitam CLS.
          <picture> negocia AVIF → WebP → JPG e usa srcSet 640/1280/1920
          (variantes geradas por scripts/generate-hero-variants.mjs). */}
      <picture className="absolute inset-0 h-full w-full">
        <source srcSet={heroSrcSet(displayedImage, 'avif')} sizes="100vw" type="image/avif" />
        <source srcSet={heroSrcSet(displayedImage, 'webp')} sizes="100vw" type="image/webp" />
        <img
          src={displayedImage.replace(/\.webp$/i, '.jpg')}
          alt="Profissionais de serviços"
          width={1920}
          height={768}
          sizes="100vw"
          fetchPriority="high"
          loading="eager"
          decoding="async"
          // @ts-expect-error - non-standard but supported by Chromium for LCP hinting
          elementtiming="hero-lcp"
          className="absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-700"
          style={{ width: '100%', height: '100%' }}
          onLoad={() => setHeroImageLoaded(true)}
        />
      </picture>


      {nextImage && (
        <picture className="absolute inset-0 h-full w-full">
          <source srcSet={heroSrcSet(nextImage, 'avif')} sizes="100vw" type="image/avif" />
          <source srcSet={heroSrcSet(nextImage, 'webp')} sizes="100vw" type="image/webp" />
          <img
            src={nextImage.replace(/\.webp$/i, '.jpg')}
            alt=""
            aria-hidden="true"
            width={1920}
            height={768}
            sizes="100vw"
            loading="eager"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover object-center animate-fade-in"
            style={{ animationDuration: '800ms', width: '100%', height: '100%' }}
          />
        </picture>
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
        <div className="w-full max-w-full px-2">
          <h1
            className="font-display font-black text-primary-foreground max-w-full text-[clamp(0.95rem,4vw,3.25rem)] leading-[1.1] sm:leading-[1.08] tracking-[-0.015em] [text-wrap:balance]"
            style={{
              textShadow: '0 2px 8px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.3)',
              // Reserva altura mínima (~2 linhas) para evitar CLS quando o rotator alterna frases (mobile-first).
              minHeight: 'clamp(2.1rem, 8.8vw, 7.15rem)',
            }}
          >
            <RotatingServiceText
              onServiceChange={handleServiceChange}
              onPhraseChange={handlePhraseChange}
            />
          </h1>
        </div>

        <div className="relative z-30 mt-4 w-full max-w-2xl md:mt-6 hero-search-wrapper min-h-[64px]">
          <div className="animate-glow-ring rounded-full">
            {enhancedSearch ? (
              <Suspense fallback={<CriticalHeroSearch onUpgrade={() => setEnhancedSearch(true)} phraseRef={phraseRef} />}>
                <SearchBar />
              </Suspense>
            ) : (
              <CriticalHeroSearch onUpgrade={() => setEnhancedSearch(true)} phraseRef={phraseRef} />
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
