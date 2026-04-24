import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Briefcase, Image as ImageIcon, User, X, ArrowRight, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProfileCompleteness } from '@/hooks/useProfileCompleteness';
import { useAuth } from '@/hooks/useAuth';
import { CELEBRATION_IDS, celebrate } from '@/lib/celebrate';

/**
 * EngagementLoop — orchestrates the "infinite engagement circuit".
 *
 * Reads the centralized `get_profile_completeness` RPC and surfaces the next
 * highest-impact action so the user is never left wondering what to do next.
 *
 * Sequence: 1º Serviço → 2º–5º Serviço → 1º Álbum → Bio Completa → Foto de Perfil.
 * When the circuit is complete (all five milestones), it shows a celebratory state.
 */
const TARGET_SERVICES = 5;
const TARGET_ALBUMS = 1;

interface NextAction {
  key: string;
  icon: typeof Sparkles;
  title: string;
  description: string;
  cta: string;
  to: string;
  tone: 'primary' | 'accent' | 'success';
}

interface EngagementLoopProps {
  /** Override fresh do dashboard — evita divergência com a RPC cacheada. */
  servicesCount?: number;
  portfolioAlbumsCount?: number;
  /** Override fresh do `checklistStats(items).pct` calculado no DashboardPage. */
  unifiedPct?: number;
}

const EngagementLoop = ({ servicesCount: servicesOverride, portfolioAlbumsCount: albumsOverride, unifiedPct }: EngagementLoopProps = {}) => {
  const navigate = useNavigate();
  const { profile, provider, user } = useAuth();
  const { data } = useProfileCompleteness();
  const [dismissed, setDismissed] = useState(false);

  const next = useMemo<NextAction | null>(() => {
    if (!data || !provider) return null;
    const services = data.counts.services;
    const albums = data.counts.albums;
    const hasBio = (provider?.description ?? '').trim().length >= 30;
    const hasAvatar = !!profile?.avatar_url || !!provider?.photo_url;

    if (services === 0) {
      return {
        key: 'first-service',
        icon: Briefcase,
        title: 'Cadastre seu primeiro serviço',
        description: 'Profissionais com serviços ativos aparecem em até 7x mais buscas.',
        cta: 'Criar serviço',
        to: '/dashboard/servicos',
        tone: 'primary',
      };
    }
    if (services < TARGET_SERVICES) {
      return {
        key: 'more-services',
        icon: Sparkles,
        title: `Você tem ${services} ${services === 1 ? 'serviço' : 'serviços'}. Que tal mais um?`,
        description: `Faltam ${TARGET_SERVICES - services} para completar o circuito recomendado e dobrar seu destaque.`,
        cta: 'Adicionar serviço',
        to: '/dashboard/servicos',
        tone: 'accent',
      };
    }
    if (albums < TARGET_ALBUMS) {
      return {
        key: 'first-album',
        icon: ImageIcon,
        title: 'Crie seu primeiro álbum de portfólio',
        description: 'Imagens reais convertem 5x mais. Mostre o que você faz de melhor.',
        cta: 'Criar álbum',
        to: '/dashboard/portfolio',
        tone: 'primary',
      };
    }
    if (!hasBio) {
      return {
        key: 'bio',
        icon: User,
        title: 'Complete sua bio profissional',
        description: 'Uma descrição com 30+ caracteres aumenta a confiança do cliente.',
        cta: 'Editar bio',
        to: '/dashboard/perfil',
        tone: 'accent',
      };
    }
    if (!hasAvatar) {
      return {
        key: 'avatar',
        icon: User,
        title: 'Adicione sua foto de perfil',
        description: 'Perfis com foto recebem até 7x mais cliques.',
        cta: 'Enviar foto',
        to: '/dashboard/perfil',
        tone: 'accent',
      };
    }
    return null;
  }, [data, profile, provider]);

  const circuitComplete = !next && data && data.percentage >= 90;

  // Dopamine bomb 💎 — fires confetti + "Ebá!" sound EXACTLY once when user first crosses 90%.
  useEffect(() => {
    if (!data || !user?.id) return;
    if (data.percentage < 90) return;
    celebrate({ intensity: 'big', id: CELEBRATION_IDS.levelUp('diamond', user.id) });
  }, [data?.percentage, user?.id]);

  if (dismissed) return null;
  if (!data) return null;

  if (circuitComplete) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-4"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600">
            <Trophy className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-foreground">Circuito completo!</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Seu perfil está {data.percentage}% completo e pronto para liderar as buscas.
              Continue evoluindo com novos serviços e fotos.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  if (!next) return null;

  const Icon = next.icon;
  const toneClasses = {
    primary: 'border-primary/30 from-primary/10 via-primary/5 text-primary',
    accent: 'border-accent/30 from-accent/10 via-accent/5 text-accent',
    success: 'border-emerald-500/30 from-emerald-500/10 via-emerald-500/5 text-emerald-600',
  }[next.tone];

  return (
    <AnimatePresence>
      <motion.div
        key={next.key}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.35 }}
        className={`relative overflow-hidden rounded-2xl border bg-gradient-to-r to-transparent p-4 ${toneClasses}`}
      >
        <button
          onClick={() => setDismissed(true)}
          className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-muted/40"
          aria-label="Dispensar sugestão"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <div className="flex items-start gap-3 pr-6">
          <motion.div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background/80 shadow-sm"
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 2.2, repeat: Infinity }}
          >
            <Icon className="h-5 w-5" />
          </motion.div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-foreground">{next.title}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{next.description}</p>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <Button size="sm" onClick={() => navigate(next.to)} className="gap-1.5">
                {next.cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[11px] text-muted-foreground">
                Perfil {data.percentage}% completo
              </span>
              <LevelBadge percentage={data.percentage} />
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

/** Visual progress badge — Bronze/Prata/Ouro/Diamante based on completeness. */
const LevelBadge = ({ percentage }: { percentage: number }) => {
  const tier =
    percentage >= 90 ? { label: 'Diamante', cls: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30' } :
    percentage >= 70 ? { label: 'Ouro', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' } :
    percentage >= 40 ? { label: 'Prata', cls: 'bg-slate-400/20 text-slate-700 dark:text-slate-200 border-slate-400/40' } :
                       { label: 'Bronze', cls: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30' };
  return (
    <motion.span
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide ${tier.cls}`}
    >
      <Trophy className="h-2.5 w-2.5" />
      Nível {tier.label}
    </motion.span>
  );
};

export default EngagementLoop;
