import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Shield, Users, Zap, Briefcase } from 'lucide-react';
import { Link } from 'react-router-dom';
import SearchBar from '@/components/SearchBar';
import heroImage from '@/assets/hero-image.webp';

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

  // Alternate between services and jobs every 5s
  useEffect(() => {
    if (!totalJobs || totalJobs <= 0) return;
    const interval = setInterval(() => setShowJobs((v) => !v), 5000);
    return () => clearInterval(interval);
  }, [totalJobs]);

  return (
    <section className="relative overflow-hidden py-16 md:py-24">
      <img
        src={heroImage}
        alt=""
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-primary/80" />
      <div className="container relative z-10 flex flex-col items-center text-center">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="font-display text-3xl font-extrabold tracking-tight text-primary-foreground md:text-5xl lg:text-6xl"
        >
          Encontre profissionais para{' '}
          <span className="text-secondary">qualquer serviço</span>
        </motion.h1>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-8 w-full max-w-2xl"
        >
          <SearchBar />
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-5 flex flex-col items-center gap-2 sm:flex-row sm:gap-4"
        >
          <p className="text-sm text-primary-foreground/80">
            Cadastre seus serviços gratuitamente.{' '}
            <Link to="/cadastro" className="font-semibold text-secondary hover:underline">Cadastrar agora →</Link>
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
          <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-secondary" /> Em todo o Brasil</span>
          <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-secondary" /> Resposta rápida</span>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroBanner;
