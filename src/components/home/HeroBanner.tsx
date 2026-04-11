import { useState, useEffect, useRef, useMemo } from 'react';
import { Shield, Users, Zap, Briefcase, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import SearchBar from '@/components/SearchBar';
import GeoLocationChip from '@/components/GeoLocationChip';
import RotatingServiceText from '@/components/home/RotatingServiceText';
import { useGeoCity } from '@/hooks/useGeoCity';
import { useSettingValue } from '@/hooks/useSiteSettings';

const FALLBACK_BG_IMAGES = [
  '/hero-bg-1.jpg', '/hero-bg-2.jpg', '/hero-bg-3.jpg', '/hero-bg-4.jpg',
  '/hero-bg-5.jpg', '/hero-bg-6.jpg', '/hero-bg-7.jpg', '/hero-bg-8.jpg',
  '/hero-bg-9.jpg', '/hero-bg-10.jpg', '/hero-bg-11.jpg', '/hero-bg-12.jpg',
  '/hero-bg-13.jpg', '/hero-bg-14.jpg', '/hero-bg-15.jpg', '/hero-bg-16.jpg',
  '/hero-bg-17.jpg', '/hero-bg-18.jpg', '/hero-bg-19.jpg', '/hero-bg-20.jpg',
];
const FALLBACK_PREFIXES = ['Encontre um', 'Preciso de um'];

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

function useCountUp(target: number, duration = 1500) {
  const [count, setCount] = useState(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    if (!target || target <= 0) return;
    const start = prevTarget.current;
    prevTarget.current = target;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(start + (target - start) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [target, duration]);

  return count;
}

/* Floating decorative dots — deferred to avoid blocking FCP */
const FloatingDots = () => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(id);
  }, []);
  if (!show) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full animate-floating-dot"
          style={{
            width: 4 + i * 3,
            height: 4 + i * 3,
            left: `${10 + i * 15}%`,
            top: `${15 + (i % 3) * 25}%`,
            background: i % 2 === 0
              ? 'hsl(var(--secondary) / 0.25)'
              : 'hsl(var(--primary-foreground) / 0.15)',
            animationDuration: `${5 + i * 0.8}s`,
            animationDelay: `${i * 0.5}s`,
            ['--dot-distance' as any]: `${-24 - i * 4}px`,
          }}
        />
      ))}
    </div>
  );
};

/** Pick N random items from an array (Fisher-Yates partial shuffle) */
function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const result: T[] = [];
  for (let i = 0; i < Math.min(n, copy.length); i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
    result.push(copy[i]);
  }
  return result;
}

const HeroBanner = () => {
  const [bgIndex, setBgIndex] = useState(0);
  const { city: geoCity } = useGeoCity();

  // Dynamic settings from admin
  const bgImagesRaw = useSettingValue('hero_bg_images');
  const prefixesRaw = useSettingValue('hero_prefixes');
  const bgIntervalRaw = useSettingValue('hero_bg_interval');
  const ctaPrimaryText = useSettingValue('hero_cta_primary_text');
  const ctaPrimaryLinkText = useSettingValue('hero_cta_primary_link_text');
  const ctaPrimaryLink = useSettingValue('hero_cta_primary_link');
  const ctaSecondaryText = useSettingValue('hero_cta_secondary_text');
  const ctaSecondaryLink = useSettingValue('hero_cta_secondary_link');

  // Pick 3 random images once per mount (session) from the full list
  const bgImages = useMemo(() => {
    const pool = bgImagesRaw
      ? bgImagesRaw.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    const source = pool.length > 0 ? pool : FALLBACK_BG_IMAGES;
    return pickRandom(source, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgImagesRaw]);

  const prefixes = useMemo(() => {
    if (!prefixesRaw) return FALLBACK_PREFIXES;
    const parsed = prefixesRaw.split(',').map(s => s.trim()).filter(Boolean);
    return parsed.length > 0 ? parsed : FALLBACK_PREFIXES;
  }, [prefixesRaw]);

  const bgInterval = Number(bgIntervalRaw) || 7000;

  // Background image rotation
  useEffect(() => {
    const interval = setInterval(() => {
      setBgIndex((prev) => (prev + 1) % bgImages.length);
    }, bgInterval);
    return () => clearInterval(interval);
  }, [bgImages.length, bgInterval]);

  // Only render current + next image to avoid loading all 20
  const visibleIndices = useMemo(() => {
    const next = (bgIndex + 1) % bgImages.length;
    return [bgIndex, next];
  }, [bgIndex, bgImages.length]);

  return (
    <section className="relative min-h-[320px] overflow-visible py-8 md:min-h-[480px] md:overflow-hidden md:py-20">
      {/* Background images — only current + next preloaded */}
      {visibleIndices.map((i) => (
        <img
          key={bgImages[i]}
          src={bgImages[i]}
          alt="Profissionais de serviços"
          width={1920}
          height={768}
          fetchpriority={i === bgIndex ? 'high' : 'low'}
          loading={i === bgIndex ? 'eager' : 'lazy'}
          decoding={i === bgIndex ? 'sync' : 'async'}
          className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-[1500ms] ease-in-out ${i === bgIndex ? 'opacity-100 hero-img-cinematic' : 'opacity-0'}`}
        />
      ))}

      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, hsl(var(--primary) / 0.8) 0%, hsl(var(--primary) / 0.65) 100%)`,
        }}
      />

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background/20 to-transparent" />

      <FloatingDots />

      <div className="container relative z-10 flex flex-col items-center text-center hero-entrance">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-primary-foreground sm:text-4xl md:text-5xl lg:text-6xl drop-shadow-sm">
            <HeroPrefixRotator prefixes={prefixes} />
            <br />
            <RotatingServiceText />
          </h1>
        </div>

        <div className="relative z-30 mt-4 w-full max-w-2xl md:mt-6">
          <div className="animate-glow-ring rounded-full">
            <SearchBar />
          </div>
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-primary-foreground/70">
            <MapPin className="h-3.5 w-3.5 text-secondary" />
            <span>{geoCity ? `Atendendo em ${geoCity} e região` : 'Profissionais próximos de você'}</span>
          </div>
        </div>

        <div className="relative z-10 mt-4 flex flex-col items-center gap-2 sm:flex-row sm:gap-4">
          <p className="text-sm text-primary-foreground/80">
            {ctaPrimaryText || 'Cadastre seus serviços gratuitamente.'}{' '}
            <Link to={ctaPrimaryLink || '/cadastro'} className="font-semibold text-secondary hover:underline underline-offset-2">
              {ctaPrimaryLinkText || 'Cadastrar agora →'}
            </Link>
          </p>
          <span className="hidden text-primary-foreground/40 sm:inline">|</span>
          <p className="text-sm text-primary-foreground/80">
            <Link to={ctaSecondaryLink || '/dashboard/vagas'} className="font-semibold text-secondary hover:underline underline-offset-2">
              {ctaSecondaryText || 'Cadastre uma vaga / oportunidade →'}
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
};

export default HeroBanner;
