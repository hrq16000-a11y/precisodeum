import { Flame, Zap, Sparkles } from 'lucide-react';

type Signal = 'em_alta' | 'responde_rapido' | 'ativo_recente' | null | undefined;

interface Props {
  signal: Signal;
  className?: string;
}

const CONFIG: Record<Exclude<Signal, null | undefined>, { label: string; Icon: typeof Flame; classes: string; title: string }> = {
  em_alta: {
    label: 'Em alta',
    Icon: Flame,
    classes: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
    title: 'Concluiu um serviço recentemente — em destaque por 3 dias.',
  },
  responde_rapido: {
    label: 'Responde rápido',
    Icon: Zap,
    classes: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
    title: 'Atendeu clientes nas últimas 24h.',
  },
  ativo_recente: {
    label: 'Ativo recentemente',
    Icon: Sparkles,
    classes: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    title: 'Esteve ativo na plataforma nos últimos 7 dias.',
  },
};

/**
 * Sinal de Vida (Recency Factor) — exibe um badge sutil indicando a atividade recente do prestador.
 * Server-side: o backend já aplica boost de visibilidade baseado em last_active_at.
 */
export default function ActivitySignalBadge({ signal, className = '' }: Props) {
  if (!signal) return null;
  const cfg = CONFIG[signal];
  if (!cfg) return null;
  const { Icon, label, classes, title } = cfg;
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${classes} ${className}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  );
}
