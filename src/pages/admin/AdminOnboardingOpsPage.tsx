/**
 * Onboarding Intelligence Center · /admin/onboarding-ops
 *
 * Central operacional de visibilidade do onboarding. NÃO altera onboarding,
 * persistência ou fluxo — apenas lê tabelas e RPCs já existentes.
 *
 * Tabs:
 *  - Funil:       admin_onboarding_ops_funnel(_hours)
 *  - Heatmap:     mesma RPC, ordenada por hotspots (recovery/validation/refresh)
 *  - Releases:    admin_onboarding_release_compare(_hours)
 *  - Forensics:   admin_onboarding_session_timeline(_session_id)
 *  - Alertas:     onboarding_events WHERE event='onboarding_regression_detected'
 *
 * Performance:
 *  - Todas as RPCs têm LIMIT server-side.
 *  - Janela máxima 30d (funnel) / 60d (releases).
 *  - Index (session_id, created_at) garante O(log n) na timeline.
 */
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Beaker,
  Brain,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  GitBranch,
  History,
  RefreshCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Radar,
  Telescope,
  Network,
  Workflow,
} from 'lucide-react';
import AdminExperimentsPanel from '@/components/admin/AdminExperimentsPanel';
import AdminIntelligencePanel from '@/components/admin/AdminIntelligencePanel';
import AdminExecutivePanel from '@/components/admin/AdminExecutivePanel';
import AdminGovernancePanel from '@/components/admin/AdminGovernancePanel';
import AdminRuntimeGovernancePanel from '@/components/admin/AdminRuntimeGovernancePanel';
import AdminSelfAuditPanel from '@/components/admin/AdminSelfAuditPanel';
import AdminEvidencePanel from '@/components/admin/AdminEvidencePanel';
import AdminRealityPanel from '@/components/admin/AdminRealityPanel';
import AdminMemoryPanel from '@/components/admin/AdminMemoryPanel';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAdmin } from '@/hooks/useAdmin';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type FunnelRow = {
  phase: string;
  enters: number;
  exits: number;
  completes: number;
  abandons: number;
  refreshes: number;
  recoveries: number;
  validation_failed: number;
  autosave_failed: number;
  regressions: number;
  unique_sessions: number;
  unique_users: number;
};

type ReleaseRow = {
  app_version: string;
  release_channel: string;
  total_events: number;
  unique_sessions: number;
  unique_users: number;
  completes: number;
  abandons: number;
  validation_failed: number;
  autosave_failed: number;
  regressions: number;
  first_seen: string;
  last_seen: string;
};

type TimelineRow = {
  id: string;
  created_at: string;
  phase: string | null;
  event: string;
  variant: string | null;
  user_id: string | null;
  meta: Record<string, unknown> | null;
};

type RegressionRow = {
  id: string;
  created_at: string;
  meta: Record<string, unknown> | null;
};

const SEVERITY_STYLES: Record<string, string> = {
  low: 'bg-slate-200 text-slate-800',
  medium: 'bg-amber-200 text-amber-900',
  high: 'bg-orange-300 text-orange-950',
  critical: 'bg-red-500 text-white',
};

/** Cálculo puro de completion rate · usado também em testes */
export function computeCompletionRate(enters: number, completes: number): number {
  if (!enters || enters <= 0) return 0;
  return Math.max(0, Math.min(1, completes / enters));
}

/** Score de hotspot para ordenar o heatmap. Peso maior em sinais ruins. */
export function computeHotspotScore(row: FunnelRow): number {
  return (
    row.recoveries * 3 +
    row.validation_failed * 2 +
    row.autosave_failed * 4 +
    row.refreshes * 1 +
    row.abandons * 2
  );
}

export default function AdminOnboardingOpsPage() {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [hours, setHours] = useState<number>(24);
  const [releaseHours, setReleaseHours] = useState<number>(72);
  const [sessionId, setSessionId] = useState<string>('');
  const [searchedSession, setSearchedSession] = useState<string>('');

  // ---- Funil ---------------------------------------------------------------
  const funnelQuery = useQuery({
    queryKey: ['admin', 'onb-ops', 'funnel', hours],
    enabled: !!isAdmin,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_onboarding_ops_funnel', {
        _hours: hours,
      } as never);
      if (error) throw error;
      return (data ?? []) as FunnelRow[];
    },
  });

  const funnel = funnelQuery.data ?? [];
  const totals = useMemo(() => {
    return funnel.reduce(
      (acc, r) => {
        acc.enters += r.enters;
        acc.completes += r.completes;
        acc.abandons += r.abandons;
        acc.recoveries += r.recoveries;
        acc.validation_failed += r.validation_failed;
        acc.regressions += r.regressions;
        acc.sessions += r.unique_sessions;
        return acc;
      },
      {
        enters: 0,
        completes: 0,
        abandons: 0,
        recoveries: 0,
        validation_failed: 0,
        regressions: 0,
        sessions: 0,
      },
    );
  }, [funnel]);

  const heatmap = useMemo(
    () =>
      [...funnel]
        .map((row) => ({ row, score: computeHotspotScore(row) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 30),
    [funnel],
  );

  // ---- Releases ------------------------------------------------------------
  const releaseQuery = useQuery({
    queryKey: ['admin', 'onb-ops', 'release', releaseHours],
    enabled: !!isAdmin,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_onboarding_release_compare', {
        _hours: releaseHours,
      } as never);
      if (error) throw error;
      return (data ?? []) as ReleaseRow[];
    },
  });

  // ---- Forensics -----------------------------------------------------------
  const timelineQuery = useQuery({
    queryKey: ['admin', 'onb-ops', 'timeline', searchedSession],
    enabled: !!isAdmin && !!searchedSession && searchedSession.length >= 3,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_onboarding_session_timeline', {
        _session_id: searchedSession,
        _limit: 500,
      } as never);
      if (error) throw error;
      return (data ?? []) as TimelineRow[];
    },
  });

  // ---- Alertas (regressões 24h) -------------------------------------------
  const alertsQuery = useQuery({
    queryKey: ['admin', 'onb-ops', 'alerts'],
    enabled: !!isAdmin,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('onboarding_events')
        .select('id, created_at, meta')
        .eq('event', 'onboarding_regression_detected')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as RegressionRow[];
    },
  });

  // ---- Incidentes (auto-response) -----------------------------------------
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [incidentScope, setIncidentScope] = useState<'open' | 'all'>('open');

  const flagsQuery = useQuery({
    queryKey: ['admin', 'onb-ops', 'flags'],
    enabled: !!isAdmin,
    staleTime: 30_000,
    queryFn: async () => {
      const keys = [
        'onboarding_auto_response_enabled',
        'onboarding_regression_watch_enabled',
        'onboarding_remote_draft_enabled',
        'onboarding_recovery_modal_enabled',
        'onboarding_remote_recovery_enabled',
        'onboarding_phase2_early_persist_enabled',
        'onboarding_multitab_detection_enabled',
        'onboarding_local_autosave_boost',
      ];
      const { data, error } = await supabase
        .from('site_settings')
        .select('key, value, updated_at')
        .in('key', keys);
      if (error) throw error;
      return data ?? [];
    },
  });

  const flagToggle = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: boolean }) => {
      const { error } = await supabase.from('site_settings').upsert(
        { key, value: value as unknown as never, updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'onb-ops', 'flags'] });
      toast({ title: 'Flag atualizada' });
    },
    onError: (e: Error) => toast({ title: 'Falha', description: e.message, variant: 'destructive' }),
  });

  const incidentsQuery = useQuery({
    queryKey: ['admin', 'onb-ops', 'incidents', incidentScope],
    enabled: !!isAdmin,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_onboarding_incidents', {
        _hours: 168,
        _only_open: incidentScope === 'open',
      } as never);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        state: string;
        severity: string;
        trigger_metric: string;
        trigger_value: number | null;
        baseline_value: number | null;
        actions: unknown;
        app_version: string | null;
        opened_at: string;
        resolved_at: string | null;
        duration_seconds: number | null;
        resolution_kind: string | null;
        notes: string | null;
      }>;
    },
  });

  const resolveIncident = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const { error } = await supabase.rpc('admin_resolve_onboarding_incident', {
        _incident_id: id,
        _notes: notes ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'onb-ops', 'incidents'] });
      toast({ title: 'Incidente resolvido manualmente' });
    },
    onError: (e: Error) => toast({ title: 'Falha', description: e.message, variant: 'destructive' }),
  });

  const evalEngine = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('evaluate_onboarding_auto_response', {
        _window_minutes: 30,
        _debounce_minutes: 30,
        _auto_resolve_minutes: 60,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'onb-ops', 'incidents'] });
      toast({ title: 'Motor executado' });
    },
    onError: (e: Error) => toast({ title: 'Falha', description: e.message, variant: 'destructive' }),
  });

  const flagsByKey = useMemo(() => {
    const map: Record<string, { value: boolean; updated_at?: string }> = {};
    for (const f of flagsQuery.data ?? []) {
      const v = f.value as unknown;
      map[f.key] = { value: v === true || v === 'true', updated_at: f.updated_at };
    }
    return map;
  }, [flagsQuery.data]);


  if (adminLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="container mx-auto flex flex-1 items-center justify-center p-6">
          <p className="text-muted-foreground">Carregando…</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="container mx-auto flex flex-1 items-center justify-center p-6">
          <p className="text-muted-foreground">Acesso restrito a administradores.</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="container mx-auto flex-1 space-y-6 p-4 md:p-6">
        {/* Cabeçalho */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Onboarding Intelligence Center
            </h1>
            <p className="text-sm text-muted-foreground">
              Central operacional · funil real, heatmap, releases, forensics e alertas. Somente leitura.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/admin/onboarding-regression">
              <Button variant="outline" size="sm" className="gap-1">
                <Activity className="h-4 w-4" /> Regression Watch
              </Button>
            </Link>
            <Link to="/admin/onboarding-stats">
              <Button variant="outline" size="sm" className="gap-1">
                <BarChart3 className="h-4 w-4" /> Stats clássico
              </Button>
            </Link>
            <Link to="/admin/onboarding-funnel">
              <Button variant="outline" size="sm" className="gap-1">
                <ExternalLink className="h-4 w-4" /> Funil V2
              </Button>
            </Link>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          <Kpi label="Entradas" value={totals.enters} hint="phase_enter na janela" />
          <Kpi label="Completes" value={totals.completes} />
          <Kpi label="Abandonos" value={totals.abandons} />
          <Kpi
            label="Completion"
            value={`${(computeCompletionRate(totals.enters, totals.completes) * 100).toFixed(1)}%`}
          />
          <Kpi label="Recoveries" value={totals.recoveries} />
          <Kpi label="Validation fails" value={totals.validation_failed} />
          <Kpi label="Regressões" value={totals.regressions} highlight={totals.regressions > 0} />
        </div>

        <Tabs defaultValue="funnel" className="space-y-4">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="executive" className="gap-1"><Sparkles className="h-4 w-4" /> Executive</TabsTrigger>
            <TabsTrigger value="funnel" className="gap-1"><BarChart3 className="h-4 w-4" /> Funil</TabsTrigger>
            <TabsTrigger value="heatmap" className="gap-1"><Flame className="h-4 w-4" /> Heatmap</TabsTrigger>
            <TabsTrigger value="behavior" className="gap-1"><Brain className="h-4 w-4" /> Behavior</TabsTrigger>
            <TabsTrigger value="releases" className="gap-1"><GitBranch className="h-4 w-4" /> Releases</TabsTrigger>
            <TabsTrigger value="gatekeeper" className="gap-1"><ShieldCheck className="h-4 w-4" /> Gatekeeper</TabsTrigger>
            <TabsTrigger value="forensics" className="gap-1"><Telescope className="h-4 w-4" /> Sessão</TabsTrigger>
            <TabsTrigger value="alerts" className="gap-1"><AlertTriangle className="h-4 w-4" /> Alertas</TabsTrigger>
            <TabsTrigger value="incidents" className="gap-1"><ShieldAlert className="h-4 w-4" /> Incidentes</TabsTrigger>
            <TabsTrigger value="experiments" className="gap-1"><Beaker className="h-4 w-4" /> Experiments</TabsTrigger>
            <TabsTrigger value="intelligence" className="gap-1"><Brain className="h-4 w-4" /> Intelligence</TabsTrigger>
            <TabsTrigger value="governance" className="gap-1"><Workflow className="h-4 w-4" /> Governance</TabsTrigger>
            <TabsTrigger value="runtime-drift" className="gap-1"><Radar className="h-4 w-4" /> Runtime Drift</TabsTrigger>
            <TabsTrigger value="self-audit" className="gap-1"><Shield className="h-4 w-4" /> Self-Audit</TabsTrigger>
            <TabsTrigger value="evidence" className="gap-1"><Network className="h-4 w-4" /> Evidence</TabsTrigger>
            <TabsTrigger value="reality" className="gap-1"><Telescope className="h-4 w-4" /> Reality</TabsTrigger>
            <TabsTrigger value="memory" className="gap-1"><History className="h-4 w-4" /> Memory</TabsTrigger>
          </TabsList>

          <TabsContent value="reality" className="space-y-3">
            <AdminRealityPanel enabled={!!isAdmin} />
          </TabsContent>

          <TabsContent value="evidence" className="space-y-3">
            <AdminEvidencePanel enabled={!!isAdmin} />
          </TabsContent>

          <TabsContent value="experiments" className="space-y-3">
            <AdminExperimentsPanel enabled={!!isAdmin} />
          </TabsContent>


          {/* === FUNIL ============================================== */}
          <TabsContent value="funnel" className="space-y-3">
            <Card>
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-lg">Funil por fase</CardTitle>
                  <CardDescription>Janela: últimas {hours}h</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="funnel-window" className="text-xs">Janela</Label>
                  <Select value={String(hours)} onValueChange={(v) => setHours(Number(v))}>
                    <SelectTrigger id="funnel-window" className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 hora</SelectItem>
                      <SelectItem value="6">6 horas</SelectItem>
                      <SelectItem value="24">24 horas</SelectItem>
                      <SelectItem value="72">72 horas</SelectItem>
                      <SelectItem value="168">7 dias</SelectItem>
                      <SelectItem value="720">30 dias</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => funnelQuery.refetch()}
                    disabled={funnelQuery.isFetching}
                  >
                    <RefreshCcw className={`h-4 w-4 ${funnelQuery.isFetching ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {funnelQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando funil…</p>
                ) : funnel.length === 0 ? (
                  <EmptyState message="Nenhum evento de onboarding na janela selecionada." />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fase</TableHead>
                          <TableHead className="text-right">Enters</TableHead>
                          <TableHead className="text-right">Exits</TableHead>
                          <TableHead className="text-right">Completes</TableHead>
                          <TableHead className="text-right">Abandons</TableHead>
                          <TableHead className="text-right">Completion</TableHead>
                          <TableHead className="text-right">Recoveries</TableHead>
                          <TableHead className="text-right">Validation</TableHead>
                          <TableHead className="text-right">Refresh</TableHead>
                          <TableHead className="text-right">Sessões</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {funnel.map((r) => (
                          <TableRow key={r.phase}>
                            <TableCell className="font-mono text-xs">{r.phase}</TableCell>
                            <TableCell className="text-right">{r.enters}</TableCell>
                            <TableCell className="text-right">{r.exits}</TableCell>
                            <TableCell className="text-right">{r.completes}</TableCell>
                            <TableCell className="text-right">{r.abandons}</TableCell>
                            <TableCell className="text-right">
                              {(computeCompletionRate(r.enters, r.completes) * 100).toFixed(0)}%
                            </TableCell>
                            <TableCell className="text-right">{r.recoveries}</TableCell>
                            <TableCell className="text-right">{r.validation_failed}</TableCell>
                            <TableCell className="text-right">{r.refreshes}</TableCell>
                            <TableCell className="text-right">{r.unique_sessions}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === HEATMAP =========================================== */}
          <TabsContent value="heatmap" className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Hotspots operacionais</CardTitle>
                <CardDescription>
                  Fases ordenadas por score de problemas (recoveries × 3 + validation × 2 + autosave_fail × 4 + abandono × 2 + refresh × 1).
                </CardDescription>
              </CardHeader>
              <CardContent>
                {heatmap.length === 0 ? (
                  <EmptyState message="Sem hotspots na janela atual — vida boa." />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Fase</TableHead>
                          <TableHead className="text-right">Score</TableHead>
                          <TableHead className="text-right">Recov.</TableHead>
                          <TableHead className="text-right">Valid.</TableHead>
                          <TableHead className="text-right">Autosave</TableHead>
                          <TableHead className="text-right">Refresh</TableHead>
                          <TableHead className="text-right">Abandon</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {heatmap.map((h, idx) => (
                          <TableRow key={h.row.phase}>
                            <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-mono text-xs">{h.row.phase}</TableCell>
                            <TableCell className="text-right font-semibold">{h.score}</TableCell>
                            <TableCell className="text-right">{h.row.recoveries}</TableCell>
                            <TableCell className="text-right">{h.row.validation_failed}</TableCell>
                            <TableCell className="text-right">{h.row.autosave_failed}</TableCell>
                            <TableCell className="text-right">{h.row.refreshes}</TableCell>
                            <TableCell className="text-right">{h.row.abandons}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === RELEASES ========================================== */}
          <TabsContent value="releases" className="space-y-3">
            <Card>
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-lg">Comparação por release</CardTitle>
                  <CardDescription>app_version × release_channel — últimas {releaseHours}h</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={String(releaseHours)} onValueChange={(v) => setReleaseHours(Number(v))}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24">24h</SelectItem>
                      <SelectItem value="72">72h</SelectItem>
                      <SelectItem value="168">7d</SelectItem>
                      <SelectItem value="720">30d</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => releaseQuery.refetch()}>
                    <RefreshCcw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {releaseQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando…</p>
                ) : (releaseQuery.data ?? []).length === 0 ? (
                  <EmptyState message="Nenhum evento com app_version registrado nesta janela." />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>app_version</TableHead>
                          <TableHead>channel</TableHead>
                          <TableHead className="text-right">Eventos</TableHead>
                          <TableHead className="text-right">Sessões</TableHead>
                          <TableHead className="text-right">Completes</TableHead>
                          <TableHead className="text-right">Abandons</TableHead>
                          <TableHead className="text-right">Validation</TableHead>
                          <TableHead className="text-right">Autosave fail</TableHead>
                          <TableHead className="text-right">Regressões</TableHead>
                          <TableHead>Primeiro</TableHead>
                          <TableHead>Último</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(releaseQuery.data ?? []).map((r) => (
                          <TableRow key={`${r.app_version}|${r.release_channel}`}>
                            <TableCell className="font-mono text-xs">{r.app_version}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{r.release_channel}</Badge>
                            </TableCell>
                            <TableCell className="text-right">{r.total_events}</TableCell>
                            <TableCell className="text-right">{r.unique_sessions}</TableCell>
                            <TableCell className="text-right">{r.completes}</TableCell>
                            <TableCell className="text-right">{r.abandons}</TableCell>
                            <TableCell className="text-right">{r.validation_failed}</TableCell>
                            <TableCell className="text-right">{r.autosave_failed}</TableCell>
                            <TableCell className="text-right">
                              {r.regressions > 0 ? (
                                <Badge className="bg-red-500 text-white">{r.regressions}</Badge>
                              ) : (
                                r.regressions
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {new Date(r.first_seen).toLocaleString('pt-BR')}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {new Date(r.last_seen).toLocaleString('pt-BR')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === FORENSICS ========================================= */}
          <TabsContent value="forensics" className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Forensics · linha do tempo da sessão</CardTitle>
                <CardDescription>
                  Cole o <code className="rounded bg-muted px-1">session_id</code> para reconstruir a jornada do usuário (PII filtrada).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-col gap-2 md:flex-row">
                  <Input
                    placeholder="session_id (mínimo 3 caracteres)"
                    value={sessionId}
                    onChange={(e) => setSessionId(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setSearchedSession(sessionId.trim());
                    }}
                  />
                  <Button
                    onClick={() => setSearchedSession(sessionId.trim())}
                    disabled={sessionId.trim().length < 3}
                    className="gap-1"
                  >
                    <Search className="h-4 w-4" /> Reconstruir
                  </Button>
                </div>

                {searchedSession ? (
                  timelineQuery.isLoading ? (
                    <p className="text-sm text-muted-foreground">Carregando timeline…</p>
                  ) : timelineQuery.error ? (
                    <p className="text-sm text-red-600">
                      Erro ao buscar timeline: {(timelineQuery.error as Error).message}
                    </p>
                  ) : (timelineQuery.data ?? []).length === 0 ? (
                    <EmptyState message="Nenhum evento encontrado para esta sessão." />
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-44">Quando</TableHead>
                            <TableHead>Fase</TableHead>
                            <TableHead>Evento</TableHead>
                            <TableHead>Variant</TableHead>
                            <TableHead>Meta</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(timelineQuery.data ?? []).map((row) => (
                            <TableRow key={row.id}>
                              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                {new Date(row.created_at).toLocaleString('pt-BR')}
                              </TableCell>
                              <TableCell className="font-mono text-xs">{row.phase ?? '—'}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="font-mono text-[10px]">
                                  {row.event}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs">{row.variant ?? '—'}</TableCell>
                              <TableCell>
                                <MetaPreview meta={row.meta} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )
                ) : (
                  <EmptyState message="Aguardando uma sessão para reconstruir." icon={<Telescope className="h-6 w-6" />} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === ALERTAS =========================================== */}
          <TabsContent value="alerts" className="space-y-3">
            <Card>
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-lg">Alertas (últimas 24h)</CardTitle>
                  <CardDescription>Regressões detectadas pelo watcher automático.</CardDescription>
                </div>
                <Link to="/admin/onboarding-regression">
                  <Button variant="outline" size="sm" className="gap-1">
                    Gerenciar watcher <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {alertsQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando…</p>
                ) : (alertsQuery.data ?? []).length === 0 ? (
                  <EmptyState message="Nenhum alerta nas últimas 24h." />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-44">Quando</TableHead>
                          <TableHead>Severidade</TableHead>
                          <TableHead>Métrica</TableHead>
                          <TableHead className="text-right">Atual</TableHead>
                          <TableHead className="text-right">Baseline</TableHead>
                          <TableHead>Release</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(alertsQuery.data ?? []).map((row) => {
                          const meta = (row.meta ?? {}) as Record<string, unknown>;
                          const severity = String(meta.severity ?? 'low');
                          const metric = String(meta.metric ?? '—');
                          const current = meta.current_value ?? meta.value ?? '—';
                          const baseline = meta.baseline_value ?? meta.baseline ?? '—';
                          const release = String(meta.app_version ?? '—');
                          return (
                            <TableRow key={row.id}>
                              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                <Clock className="mr-1 inline h-3 w-3" />
                                {new Date(row.created_at).toLocaleString('pt-BR')}
                              </TableCell>
                              <TableCell>
                                <Badge className={SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.low}>
                                  {severity}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-xs">{metric}</TableCell>
                              <TableCell className="text-right">{String(current)}</TableCell>
                              <TableCell className="text-right">{String(baseline)}</TableCell>
                              <TableCell className="font-mono text-xs">{release}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === INCIDENTES (auto-response) ======================= */}
          <TabsContent value="incidents" className="space-y-3">
            {/* Painel de controle: flags operacionais + botão "rodar motor" */}
            <Card>
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-lg">Controle operacional</CardTitle>
                  <CardDescription>
                    Feature flags vivem em <code className="rounded bg-muted px-1">site_settings</code>. O motor avalia regressões a cada 5 min via cron.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  disabled={evalEngine.isPending}
                  onClick={() => evalEngine.mutate()}
                >
                  <RefreshCcw className={`h-4 w-4 ${evalEngine.isPending ? 'animate-spin' : ''}`} />
                  Rodar motor agora
                </Button>
              </CardHeader>
              <CardContent>
                {flagsQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando flags…</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {[
                      ['onboarding_auto_response_enabled', 'Auto-response (master)'],
                      ['onboarding_regression_watch_enabled', 'Regression watcher'],
                      ['onboarding_remote_draft_enabled', 'Autosave remoto'],
                      ['onboarding_remote_recovery_enabled', 'Recovery remoto'],
                      ['onboarding_recovery_modal_enabled', 'Modal de recovery'],
                      ['onboarding_phase2_early_persist_enabled', 'Fase 2 · persist precoce'],
                      ['onboarding_multitab_detection_enabled', 'Detecção multi-aba'],
                      ['onboarding_local_autosave_boost', 'Boost autosave local'],
                    ].map(([key, label]) => {
                      const f = flagsByKey[key];
                      const on = f?.value === true;
                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between rounded-md border bg-card p-2.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{label}</p>
                            <p className="truncate font-mono text-[10px] text-muted-foreground">{key}</p>
                          </div>
                          <Switch
                            checked={on}
                            disabled={flagToggle.isPending}
                            onCheckedChange={(v) => flagToggle.mutate({ key, value: v })}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tabela de incidentes */}
            <Card>
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-lg">Incidentes (últimos 7 dias)</CardTitle>
                  <CardDescription>
                    Abertos automaticamente a partir de regressões. Auto-resolve quando a métrica normaliza por 60 min.
                  </CardDescription>
                </div>
                <Select value={incidentScope} onValueChange={(v) => setIncidentScope(v as 'open' | 'all')}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Apenas abertos</SelectItem>
                    <SelectItem value="all">Todos</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                {incidentsQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando…</p>
                ) : (incidentsQuery.data ?? []).length === 0 ? (
                  <EmptyState
                    icon={<CheckCircle2 className="h-6 w-6 text-emerald-600" />}
                    message={
                      incidentScope === 'open'
                        ? 'Nenhum incidente aberto — sistema em estado normal.'
                        : 'Sem incidentes nos últimos 7 dias.'
                    }
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Estado</TableHead>
                          <TableHead>Severidade</TableHead>
                          <TableHead>Métrica</TableHead>
                          <TableHead>Ações</TableHead>
                          <TableHead>Aberto em</TableHead>
                          <TableHead>Duração</TableHead>
                          <TableHead>Release</TableHead>
                          <TableHead className="text-right">Override</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(incidentsQuery.data ?? []).map((row) => {
                          const open = row.resolved_at === null;
                          const acts = Array.isArray(row.actions) ? (row.actions as Array<{ flag: string; to: boolean }>) : [];
                          const dur = row.duration_seconds
                            ? `${Math.round(row.duration_seconds / 60)} min`
                            : open
                              ? `${Math.round((Date.now() - new Date(row.opened_at).getTime()) / 60_000)} min (em curso)`
                              : '—';
                          return (
                            <TableRow key={row.id}>
                              <TableCell>
                                <Badge
                                  className={
                                    open
                                      ? row.state === 'incident'
                                        ? 'bg-red-500 text-white'
                                        : 'bg-amber-200 text-amber-900'
                                      : 'bg-emerald-200 text-emerald-900'
                                  }
                                >
                                  {row.state}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge className={SEVERITY_STYLES[row.severity] ?? SEVERITY_STYLES.low}>
                                  {row.severity}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-xs">{row.trigger_metric}</TableCell>
                              <TableCell className="text-xs">
                                {acts.length === 0 ? (
                                  <span className="text-muted-foreground">—</span>
                                ) : (
                                  <ul className="space-y-0.5">
                                    {acts.map((a, i) => (
                                      <li key={i} className="font-mono">
                                        {a.flag} → {String(a.to)}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                <Clock className="mr-1 inline h-3 w-3" />
                                {new Date(row.opened_at).toLocaleString('pt-BR')}
                              </TableCell>
                              <TableCell className="text-xs">{dur}</TableCell>
                              <TableCell className="font-mono text-xs">{row.app_version ?? '—'}</TableCell>
                              <TableCell className="text-right">
                                {open ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={resolveIncident.isPending}
                                    onClick={() => {
                                      if (window.confirm('Forçar resolução manual deste incidente?')) {
                                        resolveIncident.mutate({ id: row.id, notes: 'manual override via ops' });
                                      }
                                    }}
                                  >
                                    Resolver
                                  </Button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    {row.resolution_kind ?? 'resolved'}
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === GATEKEEPER ========================================== */}
          <TabsContent value="behavior" className="space-y-3">
            <BehaviorTab />
          </TabsContent>

          <TabsContent value="gatekeeper" className="space-y-3">
            <GatekeeperTab />
          </TabsContent>

          <TabsContent value="intelligence" className="space-y-3">
            <AdminIntelligencePanel />
          </TabsContent>

          <TabsContent value="executive" className="space-y-3">
            <AdminExecutivePanel />
          </TabsContent>

          <TabsContent value="governance" className="space-y-3">
            <AdminGovernancePanel />
          </TabsContent>

          <TabsContent value="runtime-drift" className="space-y-3">
            <AdminRuntimeGovernancePanel />
          </TabsContent>

          <TabsContent value="self-audit" className="space-y-3">
            <AdminSelfAuditPanel />
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}

// =====================================================================
// Gatekeeper — Release Safety
// =====================================================================

type ReleaseSnapshot = {
  id: string;
  captured_at: string;
  app_version: string | null;
  release_channel: string;
  stage: string;
  window_hours: number;
  health_score: number;
  classification: 'SAFE' | 'WARNING' | 'DEGRADED' | 'BLOCKED' | string;
  blocked: boolean;
  block_reasons: Array<{ code: string; value: number }>;
  metrics: Record<string, number>;
  open_regressions: number;
  critical_regressions: number;
  open_incidents: number;
  notes: string | null;
};

function GatekeeperTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [windowHours, setWindowHours] = useState(24);
  const [stage, setStage] = useState<'production' | 'canary' | 'staging'>('production');
  const [appVersion, setAppVersion] = useState('');
  const [notes, setNotes] = useState('');
  const [baselineId, setBaselineId] = useState<string | null>(null);
  const [candidateId, setCandidateId] = useState<string | null>(null);

  const health = useQuery({
    queryKey: ['gk-health', windowHours, stage],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('compute_onboarding_release_health', {
        _hours: windowHours,
        _channel: stage === 'production' ? null : stage,
      });
      if (error) throw error;
      return data as any;
    },
    refetchInterval: 60_000,
  });

  const snapshots = useQuery({
    queryKey: ['gk-snapshots', stage],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('list_onboarding_release_snapshots', {
        _limit: 50,
        _stage: null,
      });
      if (error) throw error;
      return (data ?? []) as ReleaseSnapshot[];
    },
  });

  const createSnap = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc('create_onboarding_release_snapshot', {
        _app_version: appVersion || null,
        _channel: stage === 'production' ? 'production' : stage,
        _stage: stage,
        _hours: windowHours,
        _notes: notes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Snapshot capturado',
        description: `Health ${data?.health_score} · ${data?.classification}`,
      });
      qc.invalidateQueries({ queryKey: ['gk-snapshots'] });
      setNotes('');
    },
    onError: (e: any) =>
      toast({ title: 'Falha ao capturar snapshot', description: String(e?.message ?? e), variant: 'destructive' }),
  });

  const compare = useQuery({
    queryKey: ['gk-compare', baselineId, candidateId],
    enabled: !!(baselineId && candidateId && baselineId !== candidateId),
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('compare_onboarding_release_snapshots', {
        _a: baselineId,
        _b: candidateId,
      });
      if (error) throw error;
      return data as any;
    },
  });

  const h = health.data ?? null;
  const klass = h?.classification ?? 'SAFE';
  const klassColor =
    klass === 'BLOCKED'
      ? 'bg-red-100 text-red-700 border-red-300'
      : klass === 'DEGRADED'
      ? 'bg-orange-100 text-orange-700 border-orange-300'
      : klass === 'WARNING'
      ? 'bg-amber-100 text-amber-700 border-amber-300'
      : 'bg-emerald-100 text-emerald-700 border-emerald-300';

  return (
    <div className="space-y-4">
      {/* Health atual */}
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5" /> Release Health (janela ao vivo)
            </CardTitle>
            <CardDescription>
              Avalia métricas dos últimos {windowHours}h e calcula score 0–100 + classificação. Apenas leitura — não dispara rollback.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={String(windowHours)} onValueChange={(v) => setWindowHours(Number(v))}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="6">Últimas 6h</SelectItem>
                <SelectItem value="24">Últimas 24h</SelectItem>
                <SelectItem value="72">Últimas 72h</SelectItem>
                <SelectItem value="168">Últimos 7d</SelectItem>
              </SelectContent>
            </Select>
            <Select value={stage} onValueChange={(v) => setStage(v as any)}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="canary">Canary</SelectItem>
                <SelectItem value="staging">Staging</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => health.refetch()}>
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {health.isLoading ? (
            <EmptyState message="Calculando health..." icon={<Activity className="h-6 w-6 animate-pulse" />} />
          ) : !h ? (
            <EmptyState message="Sem dados na janela selecionada." />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="text-5xl font-bold">{h.health_score}</div>
                <Badge className={`text-sm ${klassColor}`} variant="outline">{klass}</Badge>
                {h.blocked ? <Badge variant="destructive">BLOCKED</Badge> : null}
              </div>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
                <Kpi label="Completion" value={`${h.metrics?.completion_rate ?? 0}%`} />
                <Kpi label="Abandon" value={`${h.metrics?.abandon_rate ?? 0}%`} highlight={(h.metrics?.abandon_rate ?? 0) > 50} />
                <Kpi label="Autosave fail" value={h.metrics?.autosave_fail ?? 0} highlight={(h.metrics?.autosave_fail ?? 0) >= 10} />
                <Kpi label="Recovery corruption" value={h.metrics?.recovery_corruption ?? 0} highlight={(h.metrics?.recovery_corruption ?? 0) >= 3} />
                <Kpi label="Regressões abertas" value={h.open_regressions ?? 0} />
                <Kpi label="Críticas" value={h.critical_regressions ?? 0} highlight={(h.critical_regressions ?? 0) > 0} />
                <Kpi label="Incidentes abertos" value={h.open_incidents ?? 0} highlight={(h.open_incidents ?? 0) > 0} />
                <Kpi label="Sample (enters)" value={h.metrics?.enters ?? 0} hint="Mín. 20 p/ bloquear por completion" />
              </div>
              {h.block_reasons?.length ? (
                <div className="rounded-md border border-red-200 bg-red-50/50 p-3">
                  <p className="text-xs font-semibold text-red-700">Motivos de bloqueio / penalidade:</p>
                  <ul className="mt-1 space-y-0.5 text-xs text-red-800">
                    {h.block_reasons.map((r: any, i: number) => (
                      <li key={i}>• <code className="font-mono">{r.code}</code> = {r.value}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Capturar snapshot */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Capturar release snapshot</CardTitle>
          <CardDescription>
            Salva uma fotografia operacional (métricas + regressões + incidentes + flags). Use antes e depois do deploy para comparar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label className="text-xs">App version</Label>
              <Input value={appVersion} onChange={(e) => setAppVersion(e.target.value)} placeholder="1.1.0" />
            </div>
            <div>
              <Label className="text-xs">Stage</Label>
              <Select value={stage} onValueChange={(v) => setStage(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="canary">Canary</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Janela (h)</Label>
              <Input type="number" value={windowHours} onChange={(e) => setWindowHours(Math.max(1, Number(e.target.value) || 24))} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Notas (opcional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="baseline antes do deploy X" />
          </div>
          <Button onClick={() => createSnap.mutate()} disabled={createSnap.isPending}>
            {createSnap.isPending ? 'Capturando...' : 'Capturar snapshot agora'}
          </Button>
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Snapshots recentes</CardTitle>
          <CardDescription>Marque um baseline e um candidato para comparar.</CardDescription>
        </CardHeader>
        <CardContent>
          {snapshots.isLoading ? (
            <EmptyState message="Carregando..." />
          ) : !(snapshots.data?.length) ? (
            <EmptyState message="Nenhum snapshot capturado ainda." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Comparar</TableHead>
                    <TableHead>Capturado</TableHead>
                    <TableHead>Versão</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead className="text-right">Compl.%</TableHead>
                    <TableHead className="text-right">Regr.</TableHead>
                    <TableHead className="text-right">Inc.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshots.data.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="flex gap-1">
                        <Button
                          size="sm"
                          variant={baselineId === s.id ? 'default' : 'outline'}
                          className="h-7 px-2 text-[10px]"
                          onClick={() => setBaselineId(s.id)}
                          aria-label="Marcar como baseline"
                        >A</Button>
                        <Button
                          size="sm"
                          variant={candidateId === s.id ? 'default' : 'outline'}
                          className="h-7 px-2 text-[10px]"
                          onClick={() => setCandidateId(s.id)}
                          aria-label="Marcar como candidato"
                        >B</Button>
                      </TableCell>
                      <TableCell className="text-xs">{new Date(s.captured_at).toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="font-mono text-xs">{s.app_version ?? '—'}</TableCell>
                      <TableCell><Badge variant="outline">{s.stage}</Badge></TableCell>
                      <TableCell className="text-right font-bold">{s.health_score}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            s.classification === 'BLOCKED'
                              ? 'border-red-300 bg-red-50 text-red-700'
                              : s.classification === 'DEGRADED'
                              ? 'border-orange-300 bg-orange-50 text-orange-700'
                              : s.classification === 'WARNING'
                              ? 'border-amber-300 bg-amber-50 text-amber-700'
                              : 'border-emerald-300 bg-emerald-50 text-emerald-700'
                          }
                        >
                          {s.classification}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{s.metrics?.completion_rate ?? '—'}</TableCell>
                      <TableCell className="text-right">{s.open_regressions} ({s.critical_regressions})</TableCell>
                      <TableCell className="text-right">{s.open_incidents}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comparação */}
      {baselineId && candidateId && baselineId !== candidateId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowRight className="h-4 w-4" /> Comparação A → B
            </CardTitle>
            <CardDescription>Detecta se a release nova piorou em relação ao baseline.</CardDescription>
          </CardHeader>
          <CardContent>
            {compare.isLoading ? (
              <EmptyState message="Comparando..." />
            ) : !compare.data ? (
              <EmptyState message="Sem dados." />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
                <DeltaKpi label="Δ Health" value={compare.data.delta.health_score} inverse={false} />
                <DeltaKpi label="Δ Completion %" value={compare.data.delta.completion_rate} inverse={false} />
                <DeltaKpi label="Δ Abandon %" value={compare.data.delta.abandon_rate} inverse={true} />
                <DeltaKpi label="Δ Autosave fail" value={compare.data.delta.autosave_fail} inverse={true} />
                <DeltaKpi label="Δ Recovery corruption" value={compare.data.delta.recovery_corruption} inverse={true} />
                <DeltaKpi label="Δ Regressões" value={compare.data.delta.open_regressions} inverse={true} />
                <DeltaKpi label="Δ Críticas" value={compare.data.delta.critical_regressions} inverse={true} />
                <DeltaKpi label="Δ Incidentes" value={compare.data.delta.open_incidents} inverse={true} />
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function BehaviorTab() {
  const [hours, setHours] = useState(24);
  const q = useQuery({
    queryKey: ['behavior-summary', hours],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('admin_onboarding_behavioral_summary', { _hours: hours });
      if (error) throw error;
      return data as any;
    },
    refetchInterval: 120_000,
  });

  const phases: any[] = q.data?.phases ?? [];
  const devices: any[] = q.data?.devices ?? [];
  const sources: any[] = q.data?.sources ?? [];
  const fields: any[] = q.data?.fields ?? [];
  const patterns: any[] = q.data?.abandonment_patterns ?? [];

  const rankedPhases = useMemo(() => {
    return phases
      .map((p) => {
        const enters = Math.max(1, p.enters ?? 0);
        const score = Math.min(100, Math.round(
          ((p.abandons ?? 0) / enters) * 30 +
          ((p.hesitations ?? 0) / enters) * 15 +
          ((p.rage_clicks ?? 0) / enters) * 15 +
          ((p.repeated_validations ?? 0) / enters) * 15 +
          ((p.multi_submits ?? 0) / enters) * 10 +
          ((p.refreshes ?? 0) / enters) * 5
        ));
        return { ...p, friction: score };
      })
      .sort((a, b) => b.friction - a.friction);
  }, [phases]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg"><Brain className="h-5 w-5" /> Behavioral Funnel</CardTitle>
            <CardDescription>Comportamento real — sem PII, somente timing e frequência.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(hours)} onValueChange={(v) => setHours(Number(v))}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="6">Últimas 6h</SelectItem>
                <SelectItem value="24">Últimas 24h</SelectItem>
                <SelectItem value="72">Últimas 72h</SelectItem>
                <SelectItem value="168">Últimos 7d</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => q.refetch()}><RefreshCcw className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <EmptyState message="Carregando..." icon={<Activity className="h-6 w-6 animate-pulse" />} />
          ) : !q.data ? (
            <EmptyState message="Sem dados na janela." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="mb-2 text-sm font-semibold">Friction por fase</h4>
                {rankedPhases.length === 0 ? <p className="text-xs text-muted-foreground">Sem eventos.</p> : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Fase</TableHead><TableHead className="text-right">Enters</TableHead>
                      <TableHead className="text-right">Aband.</TableHead><TableHead className="text-right">Hesit.</TableHead>
                      <TableHead className="text-right">Rage</TableHead><TableHead className="text-right">Score</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {rankedPhases.slice(0, 10).map((p) => (
                        <TableRow key={p.phase}>
                          <TableCell className="font-mono text-xs">{p.phase}</TableCell>
                          <TableCell className="text-right">{p.enters}</TableCell>
                          <TableCell className="text-right">{p.abandons}</TableCell>
                          <TableCell className="text-right">{p.hesitations}</TableCell>
                          <TableCell className="text-right">{p.rage_clicks}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className={
                              p.friction >= 70 ? 'border-red-300 bg-red-50 text-red-700'
                              : p.friction >= 50 ? 'border-orange-300 bg-orange-50 text-orange-700'
                              : p.friction >= 25 ? 'border-amber-300 bg-amber-50 text-amber-700'
                              : 'border-emerald-300 bg-emerald-50 text-emerald-700'
                            }>{p.friction}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold">Campos mais problemáticos</h4>
                {fields.length === 0 ? <p className="text-xs text-muted-foreground">Sem eventos de campo.</p> : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Field</TableHead><TableHead className="text-right">Hesit.</TableHead>
                      <TableHead className="text-right">Rage</TableHead><TableHead className="text-right">Rep.Val.</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {fields.slice(0, 10).map((f, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{f.field}</TableCell>
                          <TableCell className="text-right">{f.hesitations}</TableCell>
                          <TableCell className="text-right">{f.rage_clicks}</TableCell>
                          <TableCell className="text-right">{f.repeated_validations}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold">Por dispositivo</h4>
                <SegmentTable rows={devices} />
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold">Por origem</h4>
                <SegmentTable rows={sources} />
              </div>
              <div className="md:col-span-2">
                <h4 className="mb-2 text-sm font-semibold">Top padrões de abandono</h4>
                {patterns.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum padrão.</p> : (
                  <ul className="space-y-1 text-xs">
                    {patterns.map((p, i) => (
                      <li key={i} className="flex items-center justify-between rounded border bg-muted/30 px-2 py-1">
                        <code className="font-mono">{p.pattern}</code>
                        <Badge variant="outline">{p.count}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SegmentTable({ rows }: { rows: any[] }) {
  if (!rows?.length) return <p className="text-xs text-muted-foreground">Sem dados.</p>;
  return (
    <Table>
      <TableHeader><TableRow>
        <TableHead>Segmento</TableHead><TableHead className="text-right">Enters</TableHead>
        <TableHead className="text-right">Compl.</TableHead><TableHead className="text-right">Aband.</TableHead>
        <TableHead className="text-right">Compl. %</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {rows.slice(0, 8).map((r, i) => {
          const rate = r.enters > 0 ? Math.round((r.completes / r.enters) * 100) : 0;
          return (
            <TableRow key={i}>
              <TableCell className="font-mono text-xs">{r.segment}</TableCell>
              <TableCell className="text-right">{r.enters}</TableCell>
              <TableCell className="text-right">{r.completes}</TableCell>
              <TableCell className="text-right">{r.abandons}</TableCell>
              <TableCell className="text-right">{rate}%</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function DeltaKpi({ label, value, inverse }: { label: string; value: number; inverse: boolean }) {
  const worse = inverse ? value > 0 : value < 0;
  const better = inverse ? value < 0 : value > 0;
  const color = worse
    ? 'border-red-300 bg-red-50/40'
    : better
    ? 'border-emerald-300 bg-emerald-50/40'
    : '';
  const sign = value > 0 ? '+' : '';
  return (
    <Card className={color}>
      <CardContent className="p-3">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-xl font-bold leading-tight">{sign}{value}</p>
      </CardContent>
    </Card>
  );
}

function Kpi({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string | number;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? 'border-red-300 bg-red-50/40' : ''}>
      <CardContent className="p-3">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-xl font-bold leading-tight">{value}</p>
        {hint ? <p className="text-[10px] text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function EmptyState({ message, icon }: { message: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed py-10 text-center text-muted-foreground">
      {icon ?? <BarChart3 className="h-6 w-6" />}
      <p className="text-sm">{message}</p>
    </div>
  );
}

function MetaPreview({ meta }: { meta: Record<string, unknown> | null }) {
  if (!meta || Object.keys(meta).length === 0) return <span className="text-muted-foreground">—</span>;
  const json = JSON.stringify(meta);
  const short = json.length > 80 ? `${json.slice(0, 80)}…` : json;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <code className="cursor-help font-mono text-[10px] text-muted-foreground">{short}</code>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-md break-all">
          <pre className="whitespace-pre-wrap text-[10px]">{JSON.stringify(meta, null, 2)}</pre>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
