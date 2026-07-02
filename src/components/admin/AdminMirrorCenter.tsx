/**
 * Admin Mirror Center
 * ─────────────────────────────────────────────────────────────────────────────
 * Painel read-only que consolida o Operational Mirror, Propagation, Lineage,
 * Blind Spots, Consensus, Visibility, Integrity e Domains.
 */
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, Network, GitBranch, EyeOff, Shield, Layers, Sparkles, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { runtimeSignalAdapter } from '@/lib/onboarding/runtimeSignalAdapter';
import { buildOperationalMirror, type OperationalMirror } from '@/lib/onboarding/operationalMirror';
import { validateOperationalContracts } from '@/lib/onboarding/operationalContractValidator';

const WINDOWS = [1, 3, 7, 14, 30] as const;

export default function AdminMirrorCenter() {
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(7);
  const [mirror, setMirror] = useState<OperationalMirror | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
          .from('onboarding_events' as any)
          .select('*')
          .gte('created_at', since)
          .order('created_at', { ascending: true })
          .limit(2000);
        if (error) throw error;
        const adapted = runtimeSignalAdapter({ events: (data || []) as any });
        if (!cancelled) {
          setMirror(buildOperationalMirror(adapted.normalizedSignals));
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'failed to load signals');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [days]);

  const contracts = useMemo(
    () => (mirror ? validateOperationalContracts(mirror.propagation.traces.length ? [] : []) : null),
    [mirror],
  );

  if (loading) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Carregando…</CardContent></Card>;
  if (error) return <Card><CardContent className="p-6 text-sm text-destructive">{error}</CardContent></Card>;
  if (!mirror) return null;

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" /> Live Operational Mirror
          </CardTitle>
          <div className="flex items-center gap-1">
            {WINDOWS.map((w) => (
              <Button
                key={w}
                size="sm"
                variant={days === w ? 'default' : 'outline'}
                onClick={() => setDays(w)}
              >
                {w}d
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            <ScoreCard label="Mirror Integrity" value={mirror.scores.mirror_integrity} />
            <ScoreCard label="Propagation" value={mirror.scores.propagation_integrity} />
            <ScoreCard label="Visibility" value={mirror.scores.systemic_visibility} />
            <ScoreCard label="Runtime Align" value={mirror.scores.runtime_alignment} />
            <ScoreCard label="Maturity" value={mirror.scores.operational_maturity} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="runtime">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="runtime" className="gap-1"><Activity className="h-3 w-3" />Runtime</TabsTrigger>
          <TabsTrigger value="propagation" className="gap-1"><Network className="h-3 w-3" />Propagation</TabsTrigger>
          <TabsTrigger value="lineage" className="gap-1"><GitBranch className="h-3 w-3" />Lineage</TabsTrigger>
          <TabsTrigger value="blindspots" className="gap-1"><EyeOff className="h-3 w-3" />Blind Spots</TabsTrigger>
          <TabsTrigger value="consensus" className="gap-1"><Layers className="h-3 w-3" />Consensus</TabsTrigger>
          <TabsTrigger value="visibility" className="gap-1"><Globe className="h-3 w-3" />Visibility</TabsTrigger>
          <TabsTrigger value="integrity" className="gap-1"><Shield className="h-3 w-3" />Integrity</TabsTrigger>
          <TabsTrigger value="domains" className="gap-1"><Layers className="h-3 w-3" />Domains</TabsTrigger>
        </TabsList>

        <TabsContent value="runtime">
          <Card><CardContent className="p-4 text-xs space-y-2">
            <div>Total signals: <b>{mirror.runtimeState.totalSignals}</b></div>
            <div>By severity: {Object.entries(mirror.runtimeState.bySeverity).map(([k, v]) => <Badge key={k} variant="outline" className="mr-1">{k}:{v}</Badge>)}</div>
            <div>By source: {Object.entries(mirror.runtimeState.bySource).map(([k, v]) => <Badge key={k} variant="outline" className="mr-1">{k}:{v}</Badge>)}</div>
            <div>Adoption level: <b>{mirror.runtimeState.adoption.adoptionLevel}</b></div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="propagation">
          <Card><CardContent className="p-4 text-xs space-y-2">
            <div>Avg depth: <b>{mirror.propagationHealth.avgDepth.toFixed(2)}</b> · density: <b>{(mirror.propagationHealth.matrixDensity * 100).toFixed(1)}%</b></div>
            <div>Anomalies: {mirror.propagation.anomalies.length}</div>
            <ul className="list-disc list-inside space-y-1">
              {mirror.propagation.anomalies.slice(0, 15).map((a, i) => (
                <li key={i}><Badge variant="outline" className="mr-1">{a.id}</Badge>{a.note}</li>
              ))}
            </ul>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="lineage">
          <Card><CardContent className="p-4 text-xs space-y-2">
            <div>Chains: {mirror.lineage.lineageChains.length} · integrity: {mirror.lineage.lineageIntegrity}%</div>
            <div>Breaks: {mirror.lineage.lineageBreaks.length} · unresolved: {mirror.lineage.unresolvedSignals.length} · duplicated paths: {mirror.lineage.duplicatedPaths.length}</div>
            <ul className="list-disc list-inside">
              {mirror.lineage.lineageBreaks.slice(0, 12).map((b, i) => (
                <li key={i}><Badge variant="outline" className="mr-1">{b.id}</Badge>{b.reason}</li>
              ))}
            </ul>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="blindspots">
          <Card><CardContent className="p-4 text-xs space-y-2">
            <div>Score: <b>{mirror.blindSpots.blindSpotScore}</b></div>
            <ul className="list-disc list-inside">
              {mirror.blindSpots.blindSpots.slice(0, 20).map((b, i) => (
                <li key={i}><Badge variant="outline" className="mr-1">{b.id}</Badge>{b.area} — {b.note}</li>
              ))}
            </ul>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="consensus">
          <Card><CardContent className="p-4 text-xs space-y-2">
            <div>Agreement: {(mirror.consensusHealth.agreementRatio * 100).toFixed(0)}%</div>
            <div>Silent engines: {mirror.consensusHealth.silentEngines.join(', ') || '—'}</div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="visibility">
          <Card><CardContent className="p-4 text-xs space-y-2">
            <div>Coverage: {mirror.evidenceHealth.coverage}%</div>
            <div>Confirmations: {mirror.evidenceHealth.confirmations}</div>
            <div>Contradictions: {mirror.evidenceHealth.contradictions}</div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="integrity">
          <Card><CardContent className="p-4 text-xs space-y-2">
            <div>Contract integrity: {contracts?.contractIntegrity ?? '—'}%</div>
            <ul className="list-disc list-inside">
              {(contracts?.findings ?? []).slice(0, 12).map((f, i) => (
                <li key={i}><Badge variant="outline" className="mr-1">{f.id}</Badge>{f.layer}: {f.note}</li>
              ))}
            </ul>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="domains">
          <Card><CardContent className="p-4 text-xs space-y-2">
            <div>Unstable domains: {mirror.unstableDomains.join(', ') || '—'}</div>
            <div>Hidden clusters: {mirror.hiddenClusters.join(', ') || '—'}</div>
            <div>Blind zones: {mirror.blindZones.join(', ') || '—'}</div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ScoreCard({ label, value }: { label: string; value: number }) {
  const tone = value >= 80 ? 'text-emerald-600' : value >= 60 ? 'text-amber-600' : 'text-destructive';
  return (
    <div className="rounded-md border p-3">
      <div className="text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold ${tone}`}>{Math.round(value)}</div>
    </div>
  );
}
