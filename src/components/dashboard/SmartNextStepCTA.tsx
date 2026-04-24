import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Camera, Phone, MapPin, FileText, Briefcase, Image as ImageIcon,
  ArrowRight, CheckCircle2, Sparkles,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  buildOnboardingChecklist, checklistStats, type ChecklistItem,
} from '@/lib/onboardingChecklist';

const ICON_BY_KEY: Record<ChecklistItem['key'], typeof Camera> = {
  photo: Camera,
  contact: Phone,
  location: MapPin,
  description: FileText,
  service: Briefcase,
  portfolio: ImageIcon,
};

const CTA_BY_KEY: Record<ChecklistItem['key'], string> = {
  photo: 'Adicionar foto agora',
  contact: 'Cadastrar WhatsApp',
  location: 'Definir cidade',
  description: 'Escrever descrição',
  service: 'Criar meu primeiro serviço',
  portfolio: 'Criar meu primeiro álbum',
};

interface Props {
  servicesCount?: number;
  portfolioAlbumsCount?: number;
  className?: string;
}

/**
 * SmartNextStepCTA — substitui o checklist passivo por UM CTA único e
 * inteligente, sempre apontando para a PRÓXIMA pendência da esteira
 * unificada (`onboardingChecklist`). Some quando tudo está concluído.
 */
const SmartNextStepCTA = ({ servicesCount, portfolioAlbumsCount, className = '' }: Props) => {
  const { profile, provider } = useAuth();

  const items = useMemo(
    () => buildOnboardingChecklist({ profile, provider, servicesCount, portfolioAlbumsCount }),
    [profile, provider, servicesCount, portfolioAlbumsCount],
  );
  const stats = checklistStats(items);

  if (stats.completed === stats.total) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-card to-primary/5 p-5 ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-base font-bold text-foreground">
              Perfil completo. Você está no topo!
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Continue ativo para manter seu destaque nas buscas.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  const next = stats.firstMissing!;
  const Icon = ICON_BY_KEY[next.key];
  const ctaLabel = CTA_BY_KEY[next.key];
  const remaining = stats.total - stats.completed;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-2xl border-2 border-accent/40 bg-gradient-to-br from-accent/10 via-card to-primary/5 p-5 shadow-card ${className}`}
    >
      <div className="absolute inset-0 shimmer opacity-10 pointer-events-none" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <motion.div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-primary text-white shadow-lg"
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Icon className="h-7 w-7" />
        </motion.div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-accent">
              Próximo passo
            </span>
          </div>
          <h3 className="mt-1 font-display text-lg font-bold text-foreground leading-tight">
            {next.label}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{next.hint}</p>

          <div className="mt-3 flex items-center gap-3">
            <Progress value={stats.pct} className="h-2 flex-1 max-w-[180px]" />
            <span className="text-xs font-semibold text-foreground">
              {stats.completed}/{stats.total}
            </span>
          </div>
        </div>

        <Button
          asChild
          size="lg"
          className="w-full shrink-0 gap-2 bg-gradient-to-r from-accent to-primary text-white shadow-md hover:opacity-90 sm:w-auto"
        >
          <Link to={next.href}>
            {ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {remaining > 1 && (
        <p className="relative mt-3 text-[11px] text-muted-foreground">
          Faltam <strong className="text-foreground">{remaining}</strong> passos para
          desbloquear seu boost de 7 dias.
        </p>
      )}
    </motion.div>
  );
};

export default SmartNextStepCTA;
