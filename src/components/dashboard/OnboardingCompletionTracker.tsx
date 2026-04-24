import { useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Camera, Phone, MapPin, FileText, Briefcase, Image as ImageIcon, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  buildOnboardingChecklist,
  checklistStats,
  type ChecklistItem,
} from '@/lib/onboardingChecklist';

const ICON_BY_KEY: Record<ChecklistItem['key'], typeof Camera> = {
  photo: Camera,
  contact: Phone,
  location: MapPin,
  description: FileText,
  service: Briefcase,
  portfolio: ImageIcon,
};

const CELEBRATION_BY_KEY: Record<ChecklistItem['key'], { title: string; desc: string }> = {
  photo: { title: 'Foto adicionada!', desc: 'Perfis com foto convertem 3x mais.' },
  contact: { title: 'Contato cadastrado!', desc: 'Clientes já podem chamar você no WhatsApp.' },
  location: { title: 'Localização definida!', desc: 'Você aparece nas buscas da sua região.' },
  description: { title: 'Descrição publicada!', desc: 'Sua apresentação está no ar.' },
  service: { title: 'Primeiro serviço criado!', desc: 'Aparição nas buscas liberada.' },
  portfolio: { title: 'Portfólio criado!', desc: 'Mostre seu trabalho com fotos reais.' },
};

const STORAGE_KEY = 'onboarding_completion_history';

interface CompletionEntry {
  key: ChecklistItem['key'];
  label: string;
  completedAt: string;
}

interface Props {
  servicesCount?: number;
  portfolioAlbumsCount?: number;
  className?: string;
}

/**
 * OnboardingCompletionTracker — detecta conclusão de cada item do onboarding
 * em tempo real, dispara toast celebrativo e renderiza histórico cronológico.
 *
 * Compartilha a fonte da verdade `onboardingChecklist.ts` com SmartNextStepCTA,
 * garantindo sincronia imediata entre celebração e atualização do CTA.
 */
const OnboardingCompletionTracker = ({
  servicesCount,
  portfolioAlbumsCount,
  className = '',
}: Props) => {
  const { profile, provider, user } = useAuth();
  const previousDoneRef = useRef<Set<ChecklistItem['key']> | null>(null);

  const items = useMemo(
    () => buildOnboardingChecklist({ profile, provider, servicesCount, portfolioAlbumsCount }),
    [profile, provider, servicesCount, portfolioAlbumsCount],
  );

  const storageKey = user?.id ? `${STORAGE_KEY}_${user.id}` : STORAGE_KEY;

  const history = useMemo<CompletionEntry[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, [storageKey, items]);

  // Detecta transições pendente → concluído e celebra cada item.
  useEffect(() => {
    if (!provider) return; // espera dados carregarem
    const currentDone = new Set(items.filter((i) => i.done).map((i) => i.key));

    // Primeira execução: só registra estado inicial sem celebrar.
    if (previousDoneRef.current === null) {
      previousDoneRef.current = currentDone;
      return;
    }

    const newlyCompleted: ChecklistItem[] = [];
    items.forEach((item) => {
      if (item.done && !previousDoneRef.current!.has(item.key)) {
        newlyCompleted.push(item);
      }
    });

    if (newlyCompleted.length > 0) {
      try {
        const existingRaw = localStorage.getItem(storageKey);
        const existing: CompletionEntry[] = existingRaw ? JSON.parse(existingRaw) : [];
        const seen = new Set(existing.map((e) => e.key));
        const additions: CompletionEntry[] = newlyCompleted
          .filter((i) => !seen.has(i.key))
          .map((i) => ({
            key: i.key,
            label: i.label,
            completedAt: new Date().toISOString(),
          }));
        if (additions.length > 0) {
          const next = [...existing, ...additions].slice(-12);
          localStorage.setItem(storageKey, JSON.stringify(next));
        }
      } catch {
        /* storage indisponível, segue sem persistir histórico */
      }

      newlyCompleted.forEach((item) => {
        const meta = CELEBRATION_BY_KEY[item.key];
        toast.success(meta.title, {
          description: meta.desc,
          icon: <CheckCircle2 className="h-4 w-4" />,
          duration: 4500,
        });
      });
    }

    previousDoneRef.current = currentDone;
  }, [items, provider, storageKey]);

  const stats = checklistStats(items);

  // Esconde a timeline apenas se tudo está completo (SmartNextStepCTA já celebra).
  if (stats.completed === stats.total) return null;

  const sorted = [...history].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  );

  const formatRelative = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60_000);
    if (min < 1) return 'agora';
    if (min < 60) return `${min}min atrás`;
    const hrs = Math.floor(min / 60);
    if (hrs < 24) return `${hrs}h atrás`;
    const days = Math.floor(hrs / 24);
    return `${days}d atrás`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-card to-card p-4 ${className}`}
    >
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <h3 className="text-sm font-bold text-foreground">Conquistas do onboarding</h3>
        <span className="ml-auto text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
          {stats.completed}/{stats.total} concluídos
        </span>
      </div>

      {/* Barra de progresso real-time */}
      <div className="mb-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-emerald-500/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
            initial={{ width: 0 }}
            animate={{ width: `${stats.pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {stats.pct}% do perfil pronto
          {stats.firstMissing && ` — próximo: ${stats.firstMissing.label.toLowerCase()}`}
        </p>
      </div>

      {sorted.length > 0 ? (
        <ul className="space-y-1.5">
          <AnimatePresence initial={false}>
            {sorted.slice(0, 5).map((entry) => {
              const Icon = ICON_BY_KEY[entry.key] ?? CheckCircle2;
              return (
                <motion.li
                  key={entry.key}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 rounded-lg bg-background/40 px-2.5 py-1.5"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Icon className="h-3 w-3" />
                  </div>
                  <span className="text-xs font-medium text-foreground flex-1 min-w-0 truncate">
                    {entry.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatRelative(entry.completedAt)}
                  </span>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Conclua o próximo passo para começar sua trilha de conquistas.
        </p>
      )}
    </motion.div>
  );
};

export default OnboardingCompletionTracker;
