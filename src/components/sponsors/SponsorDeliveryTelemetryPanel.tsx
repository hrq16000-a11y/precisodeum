/**
 * FASE 1.9 — Delivery Telemetry Panel.
 *
 * Visibilidade operacional dos bloqueios silenciosos do delivery sponsor.
 * Consulta a RPC `get_sponsor_delivery_telemetry` (admin-only), que
 * agrega `audit_log` por motivo, slot e sponsor numa janela de N dias.
 *
 * Sem realtime, sem polling: usa React Query com staleTime de 1 min.
 * Sem gráficos pesados — só KPIs, tabelas e contadores.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, AlertTriangle, Clock, RefreshCw, Slash } from 'lucide-react';

type ReasonRow = { reason: string; count: number };
type SlotRow = { slot: string; count: number };
type SponsorRow = { sponsor_id: string; title: string | null; count: number; top_reason: string };
type RecentRow = {
  sponsor_id: string;
  slot: string;
  reason: string;
  pathname: string;
  created_at: string;
};

interface TelemetryPayload {
  window_days: number;
  total: number;
  today: number;
  by_reason: ReasonRow[];
  by_slot: SlotRow[];
  top_sponsors: SponsorRow[];
  recent: RecentRow[];
}

const REASON_LABEL: Record<string, string> = {
  expired: 'Expirado',
  incomplete: 'Sem asset',
  inconsistent: 'Escopo inválido',
  blocked: 'Bloqueado',
  unknown: 'Desconhecido',
};

const REASON_TONE: Record<string, string> = {
  expired: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
  incomplete: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200',
  inconsistent: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200',
  blocked: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
};

function reasonBadge(r: string) {
  return (
    <Badge variant="outline" className={REASON_TONE[r] || ''}>
      {REASON_LABEL[r] || r}
    </Badge>
  );
}

function formatRelative(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min atrás`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h atrás`;
  const d = Math.round(h / 24);
  return `${d} d atrás`;
}

export default function SponsorDeliveryTelemetryPanel() {
  const [days, setDays] = useState(7);
  const { data, isFetching, refetch, error } = useQuery({
    queryKey: ['sponsor-delivery-telemetry', days],
    queryFn: async (): Promise<TelemetryPayload> => {
      const { data, error } = await supabase.rpc('get_sponsor_delivery_telemetry' as any, { _days: days } as any);
      if (error) throw error;
      return data as TelemetryPayload;
    },
    staleTime: 60_000,
  });

  const total = data?.total ?? 0;
  const today = data?.today ?? 0;
  const byReason = data?.by_reason ?? [];
  const bySlot = data?.by_slot ?? [];
  const topSponsors = data?.top_sponsors ?? [];
  const recent = data?.recent ?? [];

  const reasonCount = (r: string) => byReason.find((x) => x.reason === r)?.count ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">📡 Delivery Telemetry</h3>
          <p className="text-xs text-muted-foreground">
            Bloqueios silenciosos do runtime sponsor — Fase 1.9. Dedup 10 min, fire-and-forget.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="h-8 w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 dia</SelectItem>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/30">
          <CardContent className="py-3 text-sm text-destructive">
            Falha ao carregar telemetria. {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard icon={Activity} label="Bloqueios (janela)" value={total} />
        <KpiCard icon={Clock} label="Hoje" value={today} />
        <KpiCard icon={AlertTriangle} label="Expirados" value={reasonCount('expired')} tone="amber" />
        <KpiCard icon={Slash} label="Sem asset" value={reasonCount('incomplete')} tone="orange" />
        <KpiCard icon={Slash} label="Escopo inválido" value={reasonCount('inconsistent')} tone="rose" />
        <KpiCard icon={Slash} label="Bloqueados" value={reasonCount('blocked')} tone="red" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Por motivo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Motivos mais comuns</CardTitle>
          </CardHeader>
          <CardContent>
            {byReason.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum bloqueio na janela selecionada.</p>
            ) : (
              <ul className="space-y-2">
                {byReason.map((r) => (
                  <li key={r.reason} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">{reasonBadge(r.reason)}</span>
                    <span className="font-mono text-xs">{r.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Por slot */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Slots mais afetados</CardTitle>
          </CardHeader>
          <CardContent>
            {bySlot.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum slot afetado.</p>
            ) : (
              <ul className="space-y-2">
                {bySlot.map((s) => (
                  <li key={s.slot} className="flex items-center justify-between text-sm">
                    <span className="truncate font-mono text-xs">{s.slot}</span>
                    <span className="font-mono text-xs">{s.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top sponsors */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sponsors mais bloqueados</CardTitle>
        </CardHeader>
        <CardContent>
          {topSponsors.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum sponsor bloqueado na janela.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sponsor</TableHead>
                  <TableHead>Motivo principal</TableHead>
                  <TableHead className="text-right">Bloqueios</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topSponsors.map((s) => (
                  <TableRow key={s.sponsor_id}>
                    <TableCell>
                      <div className="text-sm font-medium">{s.title || '—'}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{s.sponsor_id}</div>
                    </TableCell>
                    <TableCell>{reasonBadge(s.top_reason)}</TableCell>
                    <TableCell className="text-right font-mono">{s.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recentes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Últimos bloqueios</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem eventos recentes.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Slot</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>Sponsor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((r, i) => (
                  <TableRow key={`${r.sponsor_id}-${r.created_at}-${i}`}>
                    <TableCell className="text-xs text-muted-foreground">{formatRelative(r.created_at)}</TableCell>
                    <TableCell className="font-mono text-xs">{r.slot}</TableCell>
                    <TableCell>{reasonBadge(r.reason)}</TableCell>
                    <TableCell className="max-w-[200px] truncate font-mono text-xs">{r.pathname}</TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground">{r.sponsor_id}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: number;
  tone?: 'amber' | 'orange' | 'rose' | 'red';
}) {
  const toneClass =
    tone === 'amber'
      ? 'text-amber-600 dark:text-amber-400'
      : tone === 'orange'
      ? 'text-orange-600 dark:text-orange-400'
      : tone === 'rose'
      ? 'text-rose-600 dark:text-rose-400'
      : tone === 'red'
      ? 'text-red-600 dark:text-red-400'
      : 'text-foreground';
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3">
        <Icon className={`h-5 w-5 ${toneClass}`} />
        <div>
          <div className={`text-xl font-bold leading-none ${toneClass}`}>{value}</div>
          <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
