import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Users, Zap, Briefcase, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import SearchBar from '@/components/SearchBar';
import GeoLocationChip from '@/components/GeoLocationChip';
import RotatingServiceText from '@/components/home/RotatingServiceText';
import { useHeroBanners, type HeroBannerData } from '@/hooks/useHeroBanners';
import { useGeoCity } from '@/hooks/useGeoCity';

const heroImage = '/hero-image.webp';

interface HeroBannerProps {
  totalServices?: number;
  totalJobs?: number;
}

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
    {[...Array(5)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute rounded-full bg-secondary/20"
        style={{
          width: 6 + i * 4,
          height: 6 + i * 4,
          left: `${15 + i * 18}%`,
          top: `${20 + (i % 3) * 25}%`,
        }}
        animate={{
          y: [0, -20, 0],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 4 + i,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: i * 0.7,
        }}
      />
    ))}
  </div>
);

const HeroBanner = ({ totalServices, totalJobs }: HeroBannerProps) => {
  const animatedServices = useCountUp(totalServices || 0);
  const animatedJobs = useCountUp(totalJobs || 0);
  const [showJobs, setShowJobs] = useState(false);
  const { data: banners = [] } = useHeroBanners();
  const [currentSlide, setCurrentSlide] = useState(0);
  const { city: geoCity } = useGeoCity();

  useEffect(() => {
    if (!totalJobs || totalJobs <= 0) return;
    const interval = setInterval(() => setShowJobs((v) => !v), 5000);
    return () => clearInterval(interval);
  }, [totalJobs]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [banners.length]);

  const activeBanner: HeroBannerData | null = banners.length > 0 ? banners[currentSlide] || banners[0] : null;
  const bgImage = activeBanner?.image_url || heroImage;
  const overlayOpacity = activeBanner?.overlay_opacity ?? 0.8;
  const title = activeBanner?.title || 'Encontre profissionais para';
  const subtitle = activeBanner?.subtitle || '';
  const ctaText = activeBanner?.cta_text || 'Cadastrar agora';
  const ctaLink = activeBanner?.cta_link || '/cadastro';
  const textAlign = activeBanner?.text_alignment || 'center';
  const hasCustomTitle = !!activeBanner?.title;

  const alignClass = textAlign === 'left' ? 'items-start text-left' : textAlign === 'right' ? 'items-end text-right' : 'items-center text-center';

  return (
    <section className="relative overflow-hidden py-12 md:py-28">
      <AnimatePresence mode="wait">
        <motion.img
          key={bgImage}
          src={bgImage}
          alt=""
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-center scale-105"
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1.05 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
        />
      </AnimatePresence>

      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, hsl(var(--primary) / ${overlayOpacity}) 0%, hsl(var(--primary) / ${Math.max(overlayOpacity - 0.15, 0.4)}) 100%)`,
        }}
      />

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background/20 to-transparent" />

      <FloatingDots />

      <div className={`container relative z-10 flex flex-col ${alignClass}`}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-primary-foreground sm:text-4xl md:text-5xl lg:text-6xl drop-shadow-sm">
            {hasCustomTitle ? title : (
              <>
                Encontre profissionais para{' '}
                <RotatingServiceText />
              </>
            )}
          </h1>
        </motion.div>

        {subtitle && (
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-4 text-base text-primary-foreground/80 md:text-lg max-w-2xl leading-relaxed"
          >
            {subtitle}
          </motion.p>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="mt-6 md:mt-10 w-full max-w-2xl"
        >
          <div className="rounded-2xl bg-background/10 backdrop-blur-sm p-2 ring-1 ring-primary-foreground/10">
            <SearchBar />
          </div>
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-primary-foreground/70">
            <MapPin className="h-3.5 w-3.5 text-secondary" />
            <span>{geoCity ? `Atendendo em ${geoCity} e região` : 'Profissionais próximos de você'}</span>
            <span className="text-primary-foreground/40">·</span>
            <GeoLocationChip variant="hero" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="mt-6 flex flex-col items-center gap-2 sm:flex-row sm:gap-4"
        >
          <p className="text-sm text-primary-foreground/80">
            Cadastre seus serviços gratuitamente.{' '}
            <Link to={ctaLink} className="font-semibold text-secondary hover:underline underline-offset-2">{ctaText} →</Link>
          </p>
          <span className="hidden sm:inline text-primary-foreground/40">|</span>
          <p className="text-sm text-primary-foreground/80">
            <Link to="/dashboard/vagas" className="font-semibold text-secondary hover:underline underline-offset-2">Cadastre uma vaga / oportunidade →</Link>
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-primary-foreground/80"
        >
          <span className="flex items-center gap-1.5 rounded-full bg-primary-foreground/10 px-3 py-1.5 backdrop-blur-sm">
            {showJobs && totalJobs && totalJobs > 0 ? (
              <>
                <Briefcase className="h-3.5 w-3.5 text-secondary" />
                <span className="font-semibold tabular-nums">{animatedJobs.toLocaleString('pt-BR')}</span> vagas
              </>
            ) : totalServices && totalServices > 0 ? (
              <>
                <Shield className="h-3.5 w-3.5 text-secondary" />
                <span className="font-semibold tabular-nums">{animatedServices.toLocaleString('pt-BR')}</span> serviços
              </>
            ) : (
              <>
                <Shield className="h-3.5 w-3.5 text-secondary" />
                Verificados
              </>
            )}
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-primary-foreground/10 px-3 py-1.5 backdrop-blur-sm">
            <Users className="h-3.5 w-3.5 text-secondary" />
            Profissionais verificados
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-primary-foreground/10 px-3 py-1.5 backdrop-blur-sm">
            <Zap className="h-3.5 w-3.5 text-secondary" /> Resposta rápida
          </span>
        </motion.div>

        {banners.length > 1 && (
          <div className="mt-6 flex gap-2">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`h-2 rounded-full transition-all duration-300 ${i === currentSlide ? 'w-8 bg-secondary' : 'w-2 bg-primary-foreground/40 hover:bg-primary-foreground/60'}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default HeroBanner;
