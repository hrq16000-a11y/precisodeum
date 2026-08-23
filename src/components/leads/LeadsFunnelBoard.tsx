/**
 * LeadsFunnelBoard — Pipeline visual (Novo → Atendimento → Concluído → Perdido).
 *
 * Mostra contadores e taxas de conversão por etapa. Coluna ativa filtra a
 * lista principal de leads.
 *
 * Cores semânticas:
 *   Novo       → Azul
 *   Atendimento → Amarelo (cobre 'contacted' + 'scheduled')
 *   Concluído  → Verde
 *   Perdido    → Cinza
 */
import { useMemo } from 'react';
import { Users, Activity, CheckCircle2, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import type { LeadRow, LeadStatus } from '@/hooks/useLeadFollowup';

export type FunnelKey = 'novo' | 'em_atendimento' | 'concluido' | 'perdido' | 'todos';

interface Props {
  leads: LeadRow[];
  active: FunnelKey;
  onChange: (key: FunnelKey) => void;
}

const STAGES: Array<{
  key: Exclude<FunnelKey, 'todos'>;
  label: string;
  short: string;
  matches: LeadStatus[];
  icon: typeof Users;
  color: string;
  ring: string;
}> = [
  { key: 'novo', label: 'Novo', short: 'Novos', matches: ['new'], icon: Users,
    color: 'from-blue-500 to-blue-600 text-blue-700 dark:text-blue-300',
    ring: 'border-blue-400/60 bg-blue-50/70 dark:bg-blue-950/30' },
  { key: 'em_atendimento', label: 'Em atendimento', short: 'Atendimento', matches: ['contacted', 'scheduled'], icon: Activity,
    color: 'from-amber-500 to-orange-500 text-amber-700 dark:text-amber-300',
    ring: 'border-amber-400/60 bg-amber-50/70 dark:bg-amber-950/30' },
  { key: 'concluido', label: 'Concluído', short: 'Concluídos', matches: ['completed'], icon: CheckCircle2,
    color: 'from-emerald-500 to-emerald-600 text-emerald-700 dark:text-emerald-300',
    ring: 'border-emerald-400/60 bg-emerald-50/70 dark:bg-emerald-950/30' },
  { key: 'perdido', label: 'Perdido', short: 'Perdidos', matches: ['lost'], icon: XCircle,
    color: 'from-slate-400 to-slate-500 text-slate-700 dark:text-slate-300',
    ring: 'border-slate-400/60 bg-slate-50/70 dark:bg-slate-900/40' },
];

export function statusToFunnel(status: LeadStatus): Exclude<FunnelKey, 'todos'> {
  if (status === 'new') return 'novo';
  if (status === 'completed') return 'concluido';
  if (status === 'lost') return 'perdido';
  return 'em_atendimento';
}

export default function LeadsFunnelBoard({ leads, active, onChange }: Props) {
  const counts = useMemo(() => {
    const c = { novo: 0, em_atendimento: 0, concluido: 0, perdido: 0 };
    for (const l of leads) c[statusToFunnel(l.status)]++;
    return c;
  }, [leads]);

  const total = leads.length || 1;

  return (
    <section aria-label="Funil de vendas" className="rounded-2xl border border-border bg-card p-3 shadow-card sm:p-4">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold text-foreground sm:text-base">Funil de vendas</h2>
        <button
          onClick={() => onChange('todos')}
          className={`text-[11px] font-bold uppercase tracking-wide transition ${
            active === 'todos' ? 'text-emerald-600' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Ver todos ({leads.length})
        </button>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STAGES.map((stage) => {
          const Icon = stage.icon;
          const count = counts[stage.key];
          const pct = Math.round((count / total) * 100);
          const isActive = active === stage.key;
          return (
            <motion.button
              key={stage.key}
              whileTap={{ scale: 0.97 }}
              onClick={() => onChange(stage.key)}
              className={`group relative overflow-hidden rounded-xl border p-3 text-left transition ${stage.ring} ${
                isActive ? 'ring-2 ring-offset-2 ring-emerald-400 ring-offset-background' : 'hover:shadow-md'
              }`}
              aria-pressed={isActive}
            >
              <div className="flex items-start justify-between gap-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${stage.color} text-white shadow-xs`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                  {pct}%
                </span>
              </div>
              <div className="mt-2 text-2xl font-extrabold tabular-nums text-foreground">{count}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{stage.short}</div>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-background/60">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${stage.color}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
