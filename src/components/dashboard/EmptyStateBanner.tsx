import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Briefcase, Camera, ArrowRight, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Variant = 'service' | 'portfolio';

interface Props {
  variant: Variant;
  className?: string;
}

const COPY: Record<Variant, {
  badge: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  Icon: typeof Briefcase;
  accent: string;
  bg: string;
  border: string;
}> = {
  service: {
    badge: 'Sem serviços cadastrados',
    title: 'Mostre seu trabalho: cadastre seu primeiro serviço',
    body: 'Profissionais com pelo menos 1 serviço aparecem nas buscas e começam a receber leads em até 72h.',
    cta: 'Cadastrar primeiro serviço',
    href: '/dashboard/servicos',
    Icon: Briefcase,
    accent: 'text-orange-600',
    bg: 'from-orange-500/15 via-orange-500/5 to-transparent',
    border: 'border-orange-500/40',
  },
  portfolio: {
    badge: 'Portfólio vazio',
    title: 'Profissionais com fotos ganham até 3x mais leads',
    body: 'Crie seu primeiro álbum e mostre seus trabalhos. Cliente confia em quem mostra resultado real.',
    cta: 'Criar meu primeiro álbum',
    href: '/dashboard/portfolio',
    Icon: Camera,
    accent: 'text-amber-600',
    bg: 'from-amber-500/15 via-amber-500/5 to-transparent',
    border: 'border-amber-500/40',
  },
};

/**
 * Banner de Empty State persistente, alta prioridade visual (cor viva),
 * exibido no Dashboard quando o prestador não cadastrou serviço ou portfolio.
 */
const EmptyStateBanner = ({ variant, className = '' }: Props) => {
  const c = COPY[variant];
  const Icon = c.Icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4 }}
      className={`relative overflow-hidden rounded-2xl border-2 ${c.border} bg-gradient-to-br ${c.bg} bg-card p-5 shadow-card ${className}`}
    >
      <div className="absolute inset-0 shimmer opacity-10 pointer-events-none" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <motion.div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-card shadow-md ${c.accent}`}
          animate={{ rotate: [0, -6, 6, 0] }}
          transition={{ duration: 3, repeat: Infinity, repeatDelay: 1.5 }}
        >
          <Icon className="h-7 w-7" />
        </motion.div>

        <div className="flex-1 min-w-0">
          <div className={`inline-flex items-center gap-1 rounded-full bg-card/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${c.accent}`}>
            <Zap className="h-3 w-3" /> {c.badge}
          </div>
          <h3 className="mt-1.5 font-display text-base font-bold text-foreground leading-tight sm:text-lg">
            {c.title}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{c.body}</p>
        </div>

        <Button
          asChild
          size="lg"
          className={`w-full shrink-0 gap-2 shadow-md sm:w-auto`}
        >
          <Link to={c.href}>
            {c.cta}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </motion.div>
  );
};

export default EmptyStateBanner;
