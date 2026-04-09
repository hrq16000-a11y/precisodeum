import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Shield, Users, Zap, Briefcase, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import SearchBar from '@/components/SearchBar';
import GeoLocationChip from '@/components/GeoLocationChip';
import RotatingServiceText from '@/components/home/RotatingServiceText';
import { useGeoCity } from '@/hooks/useGeoCity';

const DEFAULT_BG_IMAGES = [
  '/hero-bg-1.jpg', '/hero-bg-2.jpg', '/hero-bg-3.jpg', '/hero-bg-4.jpg',
  '/hero-bg-5.jpg', '/hero-bg-6.jpg', '/hero-bg-7.jpg', '/hero-bg-8.jpg',
  '/hero-bg-9.jpg', '/hero-bg-10.jpg', '/hero-bg-11.jpg', '/hero-bg-12.jpg',
  '/hero-bg-13.jpg', '/hero-bg-14.jpg', '/hero-bg-15.jpg', '/hero-bg-16.jpg',
  '/hero-bg-17.jpg', '/hero-bg-18.jpg', '/hero-bg-19.jpg', '/hero-bg-20.jpg',
];
const BG_INTERVAL = 7000;
const HERO_PREFIXES = ['Encontre um', 'Preciso de um'];

const HeroPrefixRotator = () => {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'visible' | 'glitch' | 'hidden'>('visible');

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase('glitch');
      setTimeout(() => {
        setPhase('hidden');
        setTimeout(() => {
          setIndex(prev => (prev + 1) % HERO_PREFIXES.length);
          setPhase('glitch');
          setTimeout(() => setPhase('visible'), 150);
        }, 100);
      }, 200);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="relative inline-block overflow-hidden">
      <span
        className={`inline-block transition-all duration-150 ${
          phase === 'visible' ? 'opacity-100 translate-y-0' :
          phase === 'glitch' ? 'opacity-80 hero-glitch-flash' :
          'opacity-0 translate-y-1'
        }`}
      >
        {HERO_PREFIXES[index]}
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

interface HeroBannerProps {}

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

/* Floating decorative dots */
const FloatingDots = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
    {[...Array(8)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute rounded-full"
        style={{
          width: 4 + i * 3,
          height: 4 + i * 3,
          left: `${10 + i * 12}%`,
          top: `${15 + (i % 4) * 20}%`,
          background: i % 2 === 0
            ? 'hsl(var(--secondary) / 0.25)'
            : 'hsl(var(--primary-foreground) / 0.15)',
        }}
        animate={{
          y: [0, -24 - i * 4, 0],
          x: [0, (i % 2 === 0 ? 8 : -8), 0],
          opacity: [0.2, 0.6, 0.2],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 5 + i * 0.8,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: i * 0.5,
        }}
      />
    ))}
    {/* Subtle geometric shapes */}
    <motion.div
      className="absolute right-[10%] top-[25%] h-16 w-16 rounded-lg border border-primary-foreground/10 rotate-45"
      animate={{ rotate: [45, 90, 45], scale: [1, 1.1, 1] }}
      transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="absolute left-[8%] bottom-[20%] h-10 w-10 rounded-full border border-secondary/20"
      animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.5, 0.2] }}
      transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
    />
  </div>
);

const HeroBanner = ({}: HeroBannerProps) => {
  const [bgIndex, setBgIndex] = useState(0);
  const { city: geoCity } = useGeoCity();

  // Background image rotation
  useEffect(() => {
    const interval = setInterval(() => {
      setBgIndex((prev) => (prev + 1) % DEFAULT_BG_IMAGES.length);
    }, BG_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-[320px] overflow-visible py-8 md:min-h-[480px] md:overflow-hidden md:py-20">
      {/* Background images with crossfade */}
      {DEFAULT_BG_IMAGES.map((src, i) => (
        <img
          key={src}
          src={src}
          alt="Profissionais de serviços"
          width={1920}
          height={768}
          fetchPriority={i === 0 ? 'high' : 'low'}
          loading={i === 0 ? 'eager' : 'lazy'}
          decoding={i === 0 ? 'sync' : 'async'}
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
            <HeroPrefixRotator />
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
            Cadastre seus serviços gratuitamente.{' '}
            <Link to="/cadastro" className="font-semibold text-secondary hover:underline underline-offset-2">Cadastrar agora →</Link>
          </p>
          <span className="hidden text-primary-foreground/40 sm:inline">|</span>
          <p className="text-sm text-primary-foreground/80">
            <Link to="/dashboard/vagas" className="font-semibold text-secondary hover:underline underline-offset-2">Cadastre uma vaga / oportunidade →</Link>
          </p>
        </div>
      </div>
    </section>
  );
};

export default HeroBanner;
