import { motion } from 'framer-motion';
import { Shield, Users, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import SearchBar from '@/components/SearchBar';
import heroImage from '@/assets/hero-image.jpg';

interface HeroBannerProps {
  totalServices?: number;
}

const HeroBanner = ({ totalServices }: HeroBannerProps) => (
  <section className="relative overflow-hidden py-16 md:py-24">
    {/* Background image */}
    <div
      className="absolute inset-0 bg-cover bg-center"
      style={{ backgroundImage: `url(${heroImage})` }}
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
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-5 text-sm text-primary-foreground/80"
      >
        Cadastre seus serviços gratuitamente e receba clientes.{' '}
        <Link to="/cadastro" className="font-semibold text-secondary hover:underline">Cadastrar agora →</Link>
      </motion.p>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45 }}
        className="mt-6 flex flex-wrap items-center justify-center gap-5 text-xs text-primary-foreground/80"
      >
        <span className="flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-secondary" />
          {totalServices && totalServices > 0
            ? `${totalServices.toLocaleString('pt-BR')} serviços publicados`
            : 'Serviços verificados'}
        </span>
        <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-secondary" /> Em todo o Brasil</span>
        <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-secondary" /> Resposta rápida</span>
      </motion.div>
    </div>
  </section>
);

export default HeroBanner;
