/**
 * AdminOnboardingFunnelPage — métricas de funil do Onboarding V2.
 *
 * Lê via RPC `admin_onboarding_funnel` (SECURITY DEFINER + has_role admin).
 * Mostra, por fase, contadores de cada evento (enter/next/back/skip/submit/error/complete)
 * e a taxa de conclusão = complete/enter.
 *
 * Sem PII: usa apenas agregados (totais e uniques de sessão/usuário).
 */

import { useEffect, useMemo, useState } from 'react';
import { Activity, RefreshCw, Filter } from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import RolloutControlCard from '@/components/admin/RolloutControlCard';

interface FunnelRow {
  phase: string;
  event: string;
  total: number;
  unique_sessions: number;
  unique_users: number;
}

const EVENT_ORDER = ['enter', 'next', 'back', 'skip', 'submit', 'error', 'complete'] as const;
type EventName = typeof EVENT_ORDER[number];

const EVENT_LABEL: Record<string, string> = {
  enter: 'Entrou',
  next: 'Avançou',
  back: 'Voltou',
  skip: 'Pulou',
  submit: 'Enviou',
  error: 'Erro',
  complete: 'Concluiu',
};

const EVENT_COLOR: Record<string, string> = {
  enter: 'bg-sky-500/10 text-sky-700',
  next: 'bg-emerald-500/10 text-emerald-700',
  back: 'bg-amber-500/10 text-amber-700',
  skip: 'bg-violet-500/10 text-violet-700',
  submit: 'bg-blue-500/10 text-blue-700',
  error: 'bg-red-500/10 text-red-700',
  complete: 'bg-emerald-600/15 text-emerald-800',
};

const PHASE_LABEL: Record<string, string> = {
  phase1_action: '1.1 Atuação',
  phase1_kind: '1.2 PF/PJ',
  phase1_location: '1.3 Local + Foto',
  phase1_contact: '1.4 Nome + WhatsApp',
  phase2_service: '2.1 Categoria + Título',
  phase2_details: '2.2 Cidades + Valores',
  phase2_photos: '2.3 Fotos',
  phase3_celebration: '3 Celebração',
  phase4_document: '4.1 CPF/CNPJ',
  phase4_extras_a: '4.2 Bairro + Bio',
  phase4_extras_b: '4.3 Redes',
  done: 'Concluído',
};

const PHASE_ORDER = Object.keys(PHASE_LABEL);

const AdminOnboardingFunnelPage = () => {
  const [days, setDays] = useState('30');
  const [variant, setVariant] = useState<string>('v2');
  const [rows, setRows] = useState<FunnelRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc('admin_onboarding_funnel', {
        _days: Number(days) || 30,
        _variant: variant === 'all' ? null : variant,
      });
      if (error) throw error;
      setRows((data || []) as FunnelRow[]);
    } catch (e: any) {
      toast.error('Falha ao carregar funil: ' + (e?.message || 'erro'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [days, variant]);

  /** Agrupa por fase → { event: total } */
  const byPhase = useMemo(() => {
    const map = new Map<string, Record<string, FunnelRow>>();
    for (const r of rows) {
      if (!map.has(r.phase)) map.set(r.phase, {});
      map.get(r.phase)![r.event] = r;
    }
    // Ordena por PHASE_ORDER, fases desconhecidas no fim
    const ordered: { phase: string; events: Record<string, FunnelRow> }[] = [];
    for (const phase of PHASE_ORDER) {
      if (map.has(phase)) ordered.push({ phase, events: map.get(phase)! });
    }
    for (const [phase, events] of map.entries()) {
      if (!PHASE_ORDER.includes(phase)) ordered.push({ phase, events });
    }
    return ordered;
  }, [rows]);

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const r of rows) t[r.event] = (t[r.event] || 0) + r.total;
    return t;
  }, [rows]);

  const conversionPct = useMemo(() => {
    const enter = totals.enter || 0;
    const complete = totals.complete || 0;
    if (!enter) return 0;
    return Math.round((complete / enter) * 100);
  }, [totals]);

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              Funil do Onboarding V2
            </h1>
            <p className="text-sm text-muted-foreground">
              Conversão e abandono por fase. Dados agregados, sem informações pessoais.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            className="hover:bg-accent/10 focus-visible:ring-2 focus-visible:ring-primary"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </header>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Filtros:
          </div>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Últimas 24h</SelectItem>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Select value={variant} onValueChange={setVariant}>
            <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="v2">Apenas V2</SelectItem>
              <SelectItem value="v1">Apenas V1</SelectItem>
              <SelectItem value="all">Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Entradas" value={totals.enter || 0} loading={loading} />
          <KpiCard label="Conclusões" value={totals.complete || 0} loading={loading} />
          <KpiCard label="Taxa de conclusão" value={`${conversionPct}%`} loading={loading} highlight />
          <KpiCard label="Erros" value={totals.error || 0} loading={loading} tone="danger" />
        </div>

        {/* Tabela por fase */}
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            {loading && rows.length === 0 ? (
              <div className="p-4 space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : byPhase.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Sem eventos no período selecionado.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Fase</th>
                    {EVENT_ORDER.map((ev) => (
                      <th key={ev} className="px-3 py-2 text-right">{EVENT_LABEL[ev]}</th>
                    ))}
                    <th className="px-3 py-2 text-right">Drop %</th>
                  </tr>
                </thead>
                <tbody>
                  {byPhase.map(({ phase, events }) => {
                    const enter = events.enter?.total || 0;
                    const next = events.next?.total || 0;
                    const drop = enter > 0 ? Math.round((1 - next / enter) * 100) : 0;
                    return (
                      <tr key={phase} className="border-t border-border hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium text-foreground">
                          {PHASE_LABEL[phase] || phase}
                        </td>
                        {EVENT_ORDER.map((ev) => {
                          const row = events[ev];
                          return (
                            <td key={ev} className="px-3 py-2 text-right tabular-nums">
                              {row ? (
                                <Badge variant="secondary" className={`${EVENT_COLOR[ev]} font-semibold`}>
                                  {row.total.toLocaleString('pt-BR')}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-right tabular-nums">
                          {enter > 0 ? (
                            <span className={drop >= 30 ? 'font-bold text-red-600' : 'text-foreground'}>
                              {drop}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <p className="text-[11px] text-muted-foreground">
          Drop % = porcentagem de quem entrou na fase mas não disparou um evento <em>next</em>.
          Use os erros e quedas para identificar onde o funil está vazando.
        </p>
      </div>
    </AdminLayout>
  );
};

interface KpiProps { label: string; value: number | string; loading?: boolean; highlight?: boolean; tone?: 'danger' }
const KpiCard = ({ label, value, loading, highlight, tone }: KpiProps) => (
  <Card className={highlight ? 'border-2 border-primary/40 bg-primary/5' : ''}>
    <CardContent className="p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="h-7 w-20 mt-1" />
      ) : (
        <p className={`font-display text-2xl font-bold tabular-nums ${tone === 'danger' ? 'text-red-600' : 'text-foreground'}`}>
          {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
        </p>
      )}
    </CardContent>
  </Card>
);

export default AdminOnboardingFunnelPage;
