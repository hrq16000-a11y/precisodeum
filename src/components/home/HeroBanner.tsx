import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Users, Zap, Briefcase, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import SearchBar from '@/components/SearchBar';
import GeoLocationChip from '@/components/GeoLocationChip';
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

const HeroBanner = ({ totalServices, totalJobs }: HeroBannerProps) => {
  const animatedServices = useCountUp(totalServices || 0);
  const animatedJobs = useCountUp(totalJobs || 0);
  const [showJobs, setShowJobs] = useState(false);
  const { data: banners = [] } = useHeroBanners();
  const [currentSlide, setCurrentSlide] = useState(0);
  const { city: geoCity } = useGeoCity();

  // Alternate between services and jobs every 5s
  useEffect(() => {
    if (!totalJobs || totalJobs <= 0) return;
    const interval = setInterval(() => setShowJobs((v) => !v), 5000);
    return () => clearInterval(interval);
  }, [totalJobs]);

  // Auto-rotate banners if multiple
  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [banners.length]);

  // Use database banner or defaults
  const activeBanner: HeroBannerData | null = banners.length > 0 ? banners[currentSlide] || banners[0] : null;
  const bgImage = activeBanner?.image_url || heroImage;
  const overlayOpacity = activeBanner?.overlay_opacity ?? 0.8;
  const title = activeBanner?.title || 'Encontre profissionais para';
  const subtitle = activeBanner?.subtitle || '';
  const ctaText = activeBanner?.cta_text || 'Cadastrar agora';
  const ctaLink = activeBanner?.cta_link || '/cadastro';
  const textAlign = activeBanner?.text_alignment || 'center';
  const animType = activeBanner?.animation_type || 'fade';
  const animDuration = (activeBanner?.animation_duration || 500) / 1000;
  const animDelay = (activeBanner?.animation_delay || 0) / 1000;

  const hasCustomTitle = !!activeBanner?.title;

  const getAnimationProps = () => {
    if (animType === 'none') return { initial: {}, animate: {}, transition: {} };
    if (animType === 'slide-up') return {
      initial: { opacity: 0, y: 30 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: animDuration, delay: animDelay },
    };
    return {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: animDuration, delay: animDelay },
    };
  };

  const anim = getAnimationProps();
  const alignClass = textAlign === 'left' ? 'items-start text-left' : textAlign === 'right' ? 'items-end text-right' : 'items-center text-center';

  return (
    <section className="relative overflow-hidden py-10 md:py-24">
      <AnimatePresence mode="wait">
        <motion.img
          key={bgImage}
          src={bgImage}
          alt=""
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        />
      </AnimatePresence>
      <div
        className="absolute inset-0"
        style={{ backgroundColor: `hsl(var(--primary) / ${overlayOpacity})` }}
      />
      <div className={`container relative z-10 flex flex-col ${alignClass}`}>
        <motion.h1
          key={title}
          {...anim}
          className="font-display text-2xl font-extrabold tracking-tight text-primary-foreground sm:text-3xl md:text-5xl lg:text-6xl"
        >
          {hasCustomTitle ? title : (
            <>
              Encontre profissionais para{' '}
              <span className="text-secondary">qualquer serviço</span>
            </>
          )}
        </motion.h1>
        {subtitle && (
          <motion.p
            {...anim}
            transition={{ ...anim.transition, delay: (animDelay || 0) + 0.1 }}
            className="mt-3 text-base text-primary-foreground/80 md:text-lg max-w-2xl"
          >
            {subtitle}
          </motion.p>
        )}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-5 md:mt-8 w-full max-w-2xl"
        >
          <SearchBar />
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-primary-foreground/70">
            <MapPin className="h-3.5 w-3.5 text-secondary" />
            <span>Mostrando resultados para <span className="font-semibold text-primary-foreground/90">{geoCity || 'sua região'}</span></span>
            <span className="text-primary-foreground/40">·</span>
            <GeoLocationChip variant="hero" />
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-5 flex flex-col items-center gap-2 sm:flex-row sm:gap-4"
        >
          <p className="text-sm text-primary-foreground/80">
            Cadastre seus serviços gratuitamente.{' '}
            <Link to={ctaLink} className="font-semibold text-secondary hover:underline">{ctaText} →</Link>
          </p>
          <span className="hidden sm:inline text-primary-foreground/40">|</span>
          <p className="text-sm text-primary-foreground/80">
            <Link to="/dashboard/vagas" className="font-semibold text-secondary hover:underline">Cadastre uma vaga / oportunidade →</Link>
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="mt-6 flex flex-wrap items-center justify-center gap-5 text-xs text-primary-foreground/80"
        >
          <span className="flex items-center gap-1.5 transition-opacity">
            {showJobs && totalJobs && totalJobs > 0 ? (
              <>
                <Briefcase className="h-3.5 w-3.5 text-secondary" />
                <span className="font-semibold tabular-nums">{animatedJobs.toLocaleString('pt-BR')}</span> vagas disponíveis
              </>
            ) : totalServices && totalServices > 0 ? (
              <>
                <Shield className="h-3.5 w-3.5 text-secondary" />
                <span className="font-semibold tabular-nums">{animatedServices.toLocaleString('pt-BR')}</span> serviços publicados
              </>
            ) : (
              <>
                <Shield className="h-3.5 w-3.5 text-secondary" />
                Serviços verificados
              </>
            )}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-secondary" />
            {geoCity ? (
              <>
                <MapPin className="h-3 w-3 text-secondary" />
                {geoCity}
              </>
            ) : (
              'Em todo o Brasil'
            )}
          </span>
          <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-secondary" /> Resposta rápida</span>
        </motion.div>

        {/* Slide indicators */}
        {banners.length > 1 && (
          <div className="mt-4 flex gap-2">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`h-2 rounded-full transition-all ${i === currentSlide ? 'w-6 bg-secondary' : 'w-2 bg-primary-foreground/40'}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default HeroBanner;
