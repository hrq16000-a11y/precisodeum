/**
 * WeeklyGoalsWidget — métricas da semana corrente (seg-dom) com metas locais.
 *
 * Read-only sobre os dados existentes (leads + lead_history). Não cria
 * pontos novos nem mexe na gamificação central — só visualiza performance.
 *
 * Metas são salvas em localStorage (por usuário), edição inline.
 */
import { useMemo, useState, useEffect } from 'react';
import { Target, Inbox, CheckCircle2, XCircle, MessageSquare, Pencil, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { LeadRow } from '@/hooks/useLeadFollowup';

interface HistoryItem { lead_id: string; entry_type: string; created_at: string; author_id?: string | null }

interface Goals { novos: number; concluidos: number; mensagens: number }

const DEFAULT_GOALS: Goals = { novos: 20, concluidos: 8, mensagens: 30 };

interface Props {
  leads: LeadRow[];
  history: Record<string, HistoryItem[]>;
  userId?: string;
}

function startOfWeek(d = new Date()): Date {
  const x = new Date(d);
  const day = x.getDay(); // 0 dom, 1 seg
  const diff = (day === 0 ? -6 : 1 - day);
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function loadGoals(userId?: string): Goals {
  if (typeof window === 'undefined') return DEFAULT_GOALS;
  try {
    const raw = localStorage.getItem(`leads:weekly-goals:${userId || 'anon'}`);
    if (!raw) return DEFAULT_GOALS;
    return { ...DEFAULT_GOALS, ...JSON.parse(raw) };
  } catch { return DEFAULT_GOALS; }
}

function saveGoals(userId: string | undefined, goals: Goals) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(`leads:weekly-goals:${userId || 'anon'}`, JSON.stringify(goals)); } catch { /* noop */ }
}

export default function WeeklyGoalsWidget({ leads, history, userId }: Props) {
  const [goals, setGoals] = useState<Goals>(() => loadGoals(userId));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Goals>(goals);

  useEffect(() => { setGoals(loadGoals(userId)); }, [userId]);

  const weekStart = useMemo(() => startOfWeek(), []);

  const stats = useMemo(() => {
    const ws = weekStart.getTime();
    let novos = 0, concluidos = 0, perdidos = 0, mensagens = 0;
    for (const l of leads) {
      const t = new Date(l.created_at).getTime();
      if (t >= ws) novos++;
    }
    for (const list of Object.values(history)) {
      for (const h of list) {
        const t = new Date(h.created_at).getTime();
        if (t < ws) continue;
        if (!userId || h.author_id === userId) {
          if (h.entry_type === 'message') mensagens++;
        }
        if (h.entry_type === 'status_change') {
          // a interface típica não traz new_status aqui — usamos heurística posterior se quiser
        }
      }
    }
    // Conta concluídos/perdidos a partir do estado atual + last_status_at na semana
    for (const l of leads) {
      const t = new Date((l as any).last_status_at || l.created_at).getTime();
      if (t < ws) continue;
      if (l.status === 'completed') concluidos++;
      if (l.status === 'lost') perdidos++;
    }
    return { novos, concluidos, perdidos, mensagens };
  }, [leads, history, weekStart, userId]);

  const cards = [
    { label: 'Novos', value: stats.novos, goal: goals.novos, icon: Inbox, color: 'from-blue-500 to-blue-600', text: 'text-blue-600 dark:text-blue-400' },
    { label: 'Concluídos', value: stats.concluidos, goal: goals.concluidos, icon: CheckCircle2, color: 'from-emerald-500 to-emerald-600', text: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Perdidos', value: stats.perdidos, goal: null as number | null, icon: XCircle, color: 'from-slate-400 to-slate-500', text: 'text-slate-600 dark:text-slate-300' },
    { label: 'Mensagens', value: stats.mensagens, goal: goals.mensagens, icon: MessageSquare, color: 'from-amber-500 to-orange-500', text: 'text-amber-600 dark:text-amber-400' },
  ];

  function commit() {
    const safe: Goals = {
      novos: Math.max(0, Math.min(999, Number(draft.novos) || 0)),
      concluidos: Math.max(0, Math.min(999, Number(draft.concluidos) || 0)),
      mensagens: Math.max(0, Math.min(999, Number(draft.mensagens) || 0)),
    };
    setGoals(safe);
    saveGoals(userId, safe);
    setEditing(false);
  }

  return (
    <section aria-label="Metas semanais" className="rounded-2xl border border-border bg-card p-3 shadow-card sm:p-4">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-bold text-foreground sm:text-base">
          <Target className="h-4 w-4 text-emerald-500" />
          Esta semana
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            desde {weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
          </span>
        </h2>
        {!editing ? (
          <button
            type="button"
            onClick={() => { setDraft(goals); setEditing(true); }}
            className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground transition hover:text-foreground"
          >
            <Pencil className="h-3 w-3" /> Metas
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-7 px-2"><X className="h-3.5 w-3.5" /></Button>
            <Button size="sm" onClick={commit} className="h-7 px-2"><Save className="h-3.5 w-3.5" /> Salvar</Button>
          </div>
        )}
      </header>

      {editing && (
        <div className="mb-3 grid grid-cols-3 gap-2 rounded-lg border border-dashed border-border p-2">
          {(['novos', 'concluidos', 'mensagens'] as const).map((k) => (
            <label key={k} className="block">
              <span className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{k}</span>
              <Input
                type="number"
                min={0}
                value={draft[k]}
                onChange={(e) => setDraft(d => ({ ...d, [k]: Number(e.target.value) }))}
                className="h-8"
              />
            </label>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          const pct = c.goal != null && c.goal > 0 ? Math.min(100, Math.round((c.value / c.goal) * 100)) : null;
          return (
            <div key={c.label} className="rounded-xl border border-border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-1">
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br ${c.color} text-white shadow-sm`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                {pct != null && (
                  <span className={`rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] font-bold ${pct >= 100 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                    {pct}%
                  </span>
                )}
              </div>
              <div className={`mt-2 text-2xl font-extrabold tabular-nums ${c.text}`}>{c.value}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {c.label}
                {c.goal != null && <span className="ml-1 normal-case text-muted-foreground/70">/ meta {c.goal}</span>}
              </div>
              {pct != null && (
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-background/60">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${c.color} transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
