import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import RotatingServiceText from '@/components/home/RotatingServiceText';
import { useGeoCity } from '@/hooks/useGeoCity';
import { useSettingValue } from '@/hooks/useSiteSettings';
import { importWithRetry } from '@/lib/lazyWithRetry';
import { getCategoryForService, CATEGORY_IMAGES, type ServiceCategory } from '@/lib/serviceCategoryMap';

const SearchBar = lazy(() => importWithRetry(() => import('@/components/SearchBar')));

const FALLBACK_PREFIXES = ['Encontre o melhor', 'Preciso de'];

const HeroPrefixRotator = ({ prefixes }: { prefixes: string[] }) => {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'visible' | 'glitch' | 'hidden'>('visible');

  useEffect(() => {
    if (prefixes.length <= 1) return;
    const interval = setInterval(() => {
      setPhase('glitch');
      setTimeout(() => {
        setPhase('hidden');
        setTimeout(() => {
          setIndex(prev => (prev + 1) % prefixes.length);
          setPhase('glitch');
          setTimeout(() => setPhase('visible'), 150);
        }, 100);
      }, 200);
    }, 5000);
    return () => clearInterval(interval);
  }, [prefixes.length]);

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
  const { city: geoCity } = useGeoCity();

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
    const cat = getCategoryForService(service);
    const newImg = CATEGORY_IMAGES[cat];
    if (newImg !== displayedImage) {
      setNextImage(newImg);
      setTimeout(() => {
        setDisplayedImage(newImg);
        setNextImage(null);
      }, 800);
    }
  }, [displayedImage]);

  // Deferred preload of next image — no forced reflow
  useEffect(() => {
    const id = setTimeout(() => {
      const allImages = Object.values(CATEGORY_IMAGES);
      const currentIdx = allImages.indexOf(displayedImage);
      const nextIdx = (currentIdx + 1) % allImages.length;
      const img = new Image();
      img.src = allImages[nextIdx];
    }, 2000);
    return () => clearTimeout(id);
  }, [displayedImage]);

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
        decoding="sync"
        className="absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-700"
        style={{ width: '100%', height: '100%' }}
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
          background: `linear-gradient(135deg, hsl(var(--primary) / 0.8) 0%, hsl(var(--primary) / 0.65) 100%)`,
        }}
      />

      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background/20 to-transparent" />

      <div className="container relative z-10 flex flex-col items-center text-center hero-entrance">
        <div className="w-full max-w-full overflow-hidden px-4">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-primary-foreground sm:text-3xl md:text-5xl lg:text-6xl drop-shadow-sm max-w-full overflow-hidden">
            <HeroPrefixRotator prefixes={prefixes} />
            <br />
            <RotatingServiceText onServiceChange={handleServiceChange} />
          </h1>
        </div>

        <div className="relative z-30 mt-4 w-full max-w-2xl md:mt-6">
          <Suspense fallback={<div className="h-12 rounded-full bg-primary-foreground/10 animate-pulse" />}>
            <div className="animate-glow-ring rounded-full">
              <SearchBar />
            </div>
          </Suspense>
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-primary-foreground/70">
            <MapPin className="h-3.5 w-3.5 text-secondary" />
            <span>{geoCity ? `Atendendo em ${geoCity} e região` : 'Profissionais próximos de você'}</span>
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
