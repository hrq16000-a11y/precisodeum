/**
 * AdminRealityPanel · aba "Reality" em /admin/onboarding-ops
 *
 * Reconstrução forense por sessão (READ-ONLY). Lê `onboarding_events` via a
 * RPC já existente `admin_onboarding_session_timeline` e cruza com sinais de
 * backend (provider/service/onboarding_completed/draft) para detectar:
 *   phantom success · silent failure · partial persistence · zombie draft
 *   hidden loop · retry storm · dead navigation · toast vs reality
 *   UI/DB divergence · impossible state · session fragmentation
 *
 * Não escreve nada. Não captura PII. Não usa realtime.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertOctagon,
  AlertTriangle,
  Bug,
  GitFork,
  Layers,
  Network,
  RefreshCcw,
  Search,
  ShieldAlert,
  Workflow,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import {
  buildRealityReport,
  sanitizeMeta,
  type BackendTruth,
  type ForensicEvent,
  type ForensicFinding,
} from '@/lib/onboarding/operationalReality';

interface Props {
  enabled: boolean;
}

const SEV_STYLE: Record<ForensicFinding['severity'], string> = {
  low: 'bg-slate-200 text-slate-800',
  medium: 'bg-amber-200 text-amber-900',
  high: 'bg-orange-300 text-orange-950',
  critical: 'bg-red-500 text-white',
};

function ScoreBadge({ label, value }: { label: string; value: number }) {
  const tone =
    value >= 80 ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
    value >= 60 ? 'bg-amber-100 text-amber-800 border-amber-300' :
    'bg-red-100 text-red-800 border-red-300';
  return (
    <div className={`rounded-lg border px-3 py-2 ${tone}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export default function AdminRealityPanel({ enabled }: Props) {
  const [sessionId, setSessionId] = useState('');
  const [searched, setSearched] = useState('');

  const timelineQuery = useQuery({
    queryKey: ['admin', 'reality', 'timeline', searched],
    enabled: enabled && searched.length >= 3,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_onboarding_session_timeline', {
        _session_id: searched,
        _limit: 500,
      } as never);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        created_at: string;
        phase: string | null;
        event: string;
        user_id: string | null;
        meta: Record<string, unknown> | null;
      }>;
    },
  });

  const backendQuery = useQuery({
    queryKey: ['admin', 'reality', 'backend', searched],
    enabled: enabled && searched.length >= 3 && !!timelineQuery.data?.length,
    staleTime: 60_000,
    queryFn: async (): Promise<BackendTruth | null> => {
      const userId = timelineQuery.data?.find((e) => e.user_id)?.user_id;
      if (!userId) return null;
      const [providerRes, serviceRes] = await Promise.all([
        supabase.from('providers').select('id, onboarding_completed').eq('user_id', userId).maybeSingle(),
        supabase.from('services').select('id, category_id').eq('user_id', userId).limit(1).maybeSingle(),
      ]);
      const provider = providerRes.data as { id?: string; onboarding_completed?: boolean } | null;
      const service = serviceRes.data as { id?: string; category_id?: string | null } | null;
      return {
        has_provider: !!provider?.id,
        has_service: !!service?.id,
        onboarding_completed: !!provider?.onboarding_completed,
        service_has_category: service ? !!service.category_id : undefined,
        has_draft: undefined,
        draft_envelope_valid: true,
      };
    },
  });

  const report = useMemo(() => {
    const rows = timelineQuery.data ?? [];
    if (!rows.length) return null;
    const events: ForensicEvent[] = rows.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      phase: r.phase,
      event: r.event,
      session_id: searched,
      user_id: r.user_id,
      meta: sanitizeMeta(r.meta),
      app_version: (r.meta as any)?.app_version ?? null,
      device_id: (r.meta as any)?.device_id ?? null,
    }));
    return buildRealityReport(events, backendQuery.data ?? null);
  }, [timelineQuery.data, backendQuery.data, searched]);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setSearched(sessionId.trim());
  };

  const findingsByKind = useMemo(() => {
    const map = new Map<string, ForensicFinding[]>();
    for (const f of report?.findings ?? []) {
      const arr = map.get(f.kind) ?? [];
      arr.push(f);
      map.set(f.kind, arr);
    }
    return map;
  }, [report]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Network className="h-5 w-5" /> Operational Reality · Forensic Reconstruction
        </CardTitle>
        <CardDescription>
          Reconstrução read-only por sessão. Cruza eventos UI ↔ backend para detectar phantom success,
          silent failure, zombie draft, hidden loops e divergências. Sem PII, sem replay visual.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={submit} className="flex flex-col gap-2 md:flex-row md:items-end">
          <div className="flex-1 space-y-1">
            <Label htmlFor="reality-session" className="text-xs">Session ID</Label>
            <Input
              id="reality-session"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              placeholder="ex.: 7b3c... (mínimo 3 caracteres)"
            />
          </div>
          <Button type="submit" disabled={sessionId.trim().length < 3} className="gap-1">
            <Search className="h-4 w-4" /> Reconstruir
          </Button>
        </form>

        {searched && timelineQuery.isLoading && (
          <p className="text-sm text-muted-foreground">Carregando timeline…</p>
        )}
        {searched && !timelineQuery.isLoading && !timelineQuery.data?.length && (
          <p className="text-sm text-muted-foreground">Nenhum evento para essa sessão na janela disponível.</p>
        )}

        {report && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <ScoreBadge label="Truth" value={report.scores.operational_truth_score} />
              <ScoreBadge label="Persistence" value={report.scores.persistence_integrity_score} />
              <ScoreBadge label="Recovery" value={report.scores.recovery_integrity_score} />
              <ScoreBadge label="Flow" value={report.scores.flow_trust_score} />
              <ScoreBadge label="Session" value={report.scores.session_integrity_score} />
            </div>

            <Tabs defaultValue="timeline" className="space-y-3">
              <TabsList className="flex flex-wrap">
                <TabsTrigger value="timeline" className="gap-1"><Workflow className="h-4 w-4" /> Timeline</TabsTrigger>
                <TabsTrigger value="divergences" className="gap-1"><GitFork className="h-4 w-4" /> Divergences</TabsTrigger>
                <TabsTrigger value="phantom" className="gap-1"><AlertOctagon className="h-4 w-4" /> Phantom Success</TabsTrigger>
                <TabsTrigger value="zombie" className="gap-1"><Bug className="h-4 w-4" /> Zombie Drafts</TabsTrigger>
                <TabsTrigger value="loops" className="gap-1"><RefreshCcw className="h-4 w-4" /> Hidden Loops</TabsTrigger>
                <TabsTrigger value="fragmentation" className="gap-1"><Layers className="h-4 w-4" /> Fragmentation</TabsTrigger>
                <TabsTrigger value="integrity" className="gap-1"><ShieldAlert className="h-4 w-4" /> Integrity</TabsTrigger>
                <TabsTrigger value="graph" className="gap-1"><Network className="h-4 w-4" /> Truth Graph</TabsTrigger>
              </TabsList>

              <TabsContent value="timeline">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>+ms</TableHead>
                      <TableHead>Fase</TableHead>
                      <TableHead>Evento</TableHead>
                      <TableHead>Flags</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.journey.timeline.slice(0, 200).map((t, i) => {
                      const flags = [
                        ...t.integrity_flags.map((f) => `int:${f}`),
                        ...t.truth_flags.map((f) => `truth:${f}`),
                        ...t.divergence_flags.map((f) => `div:${f}`),
                        ...t.retry_flags.map((f) => `retry:${f}`),
                        ...t.recovery_flags.map((f) => `rec:${f}`),
                      ];
                      return (
                        <TableRow key={i}>
                          <TableCell className="tabular-nums text-xs">{t.relative_ms}</TableCell>
                          <TableCell className="text-xs">{t.phase ?? '—'}</TableCell>
                          <TableCell className="text-xs font-mono">{t.event}</TableCell>
                          <TableCell className="text-xs">
                            {flags.length ? flags.map((f) => (
                              <Badge key={f} variant="outline" className="mr-1 mb-1 text-[10px]">{f}</Badge>
                            )) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TabsContent>

              {(['divergences', 'phantom', 'zombie', 'loops', 'fragmentation', 'integrity'] as const).map((tab) => {
                const filter: Record<typeof tab, string[]> = {
                  divergences: ['ui_vs_backend_divergence', 'toast_vs_reality', 'impossible_state'],
                  phantom: ['phantom_success', 'silent_failure'],
                  zombie: ['zombie_draft', 'recovery_integrity_failure'],
                  loops: ['hidden_loop', 'retry_storm', 'dead_navigation'],
                  fragmentation: ['session_fragmentation', 'state_fragmentation'],
                  integrity: ['partial_persistence', 'broken_chain', 'incomplete_transaction'],
                };
                const list = (report.findings ?? []).filter((f) => filter[tab].includes(f.kind));
                return (
                  <TabsContent key={tab} value={tab}>
                    {!list.length ? (
                      <p className="text-sm text-muted-foreground">Sem ocorrências nessa categoria.</p>
                    ) : (
                      <div className="space-y-2">
                        {list.map((f, i) => (
                          <div key={i} className="rounded-md border p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className={SEV_STYLE[f.severity]}>{f.severity}</Badge>
                              <span className="font-mono text-xs">{f.kind}</span>
                              {f.phase && <Badge variant="outline" className="text-[10px]">{f.phase}</Badge>}
                            </div>
                            <p className="mt-1 text-sm">{f.reason}</p>
                            {!!f.evidence.length && (
                              <p className="mt-1 text-xs text-muted-foreground">Evidência: {f.evidence.join(' · ')}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                );
              })}

              <TabsContent value="graph">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <h4 className="mb-2 text-sm font-medium">Nodes ({report.graph.nodes.length})</h4>
                    <div className="max-h-72 space-y-1 overflow-auto rounded-md border p-2">
                      {report.graph.nodes.map((n) => (
                        <div key={n.id} className="flex items-center justify-between text-xs">
                          <span className="font-mono">{n.label}</span>
                          <Badge variant="outline">{n.kind} · {n.occurrences}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="mb-2 text-sm font-medium">Edges ({report.graph.edges.length})</h4>
                    <div className="max-h-72 space-y-1 overflow-auto rounded-md border p-2">
                      {report.graph.edges.map((e, i) => (
                        <div key={i} className="text-xs">
                          <span className="font-mono">{e.from}</span>
                          {' → '}
                          <span className="font-mono">{e.to}</span>
                          {' '}
                          <Badge variant="outline" className="text-[10px]">{e.kind} ×{e.weight}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {!findingsByKind.size && (
              <p className="flex items-center gap-2 text-sm text-emerald-700">
                <AlertTriangle className="h-4 w-4" /> Nenhum forensic finding detectado para essa sessão.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
