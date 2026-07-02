/**
 * AdminSignalCenter — painel read-only do Runtime Signal Integration Layer.
 * Lê onboarding_events / onboarding_incidents / onboarding_release_snapshots /
 * onboarding_experiments / site_settings (últimos N) e exibe normalização,
 * qualidade, feed de evidência, reconstrução forense e mapa de cobertura.
 *
 * Sem realtime, sem mutação, sem auto-cura.
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  runtimeSignalAdapter,
  integrateRuntimeSignals,
  computeSignalQuality,
  buildEvidenceFeed,
  reconstructOperationalSession,
  computeSystemicCoverage,
} from '@/lib/onboarding/runtimeSignalAdapter';

const LIMIT = 500;

async function fetchSignals() {
  const [events, incidents, releases, experiments, flags] = await Promise.all([
    supabase.from('onboarding_events' as any).select('*').order('created_at', { ascending: false }).limit(LIMIT),
    supabase.from('onboarding_incidents' as any).select('*').order('detected_at', { ascending: false }).limit(LIMIT).then((r) => r, () => ({ data: [] as any[] })),
    supabase.from('onboarding_release_snapshots' as any).select('*').order('captured_at', { ascending: false }).limit(100).then((r) => r, () => ({ data: [] as any[] })),
    supabase.from('onboarding_experiments' as any).select('*').limit(100).then((r) => r, () => ({ data: [] as any[] })),
    supabase.from('site_settings' as any).select('*').limit(200).then((r) => r, () => ({ data: [] as any[] })),
  ]);
  return {
    events: events.data ?? [],
    incidents: (incidents as any).data ?? [],
    releases: (releases as any).data ?? [],
    experiments: (experiments as any).data ?? [],
    flags: (flags as any).data ?? [],
  };
}

function ScoreBadge({ label, value }: { label: string; value: number }) {
  const color = value >= 75 ? 'bg-emerald-500/15 text-emerald-700' : value >= 50 ? 'bg-amber-500/15 text-amber-700' : 'bg-red-500/15 text-red-700';
  return (
    <div className={`rounded-md px-3 py-2 ${color}`}>
      <div className="text-xs uppercase opacity-70">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

export default function AdminSignalCenter() {
  const [sessionInput, setSessionInput] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['admin-signal-center'],
    queryFn: fetchSignals,
    staleTime: 60_000,
  });

  const adapter = useMemo(() => runtimeSignalAdapter(data ?? {}), [data]);
  const quality = useMemo(() => computeSignalQuality(adapter.normalizedSignals, adapter), [adapter]);
  const integration = useMemo(() => integrateRuntimeSignals(adapter.normalizedSignals), [adapter]);
  const feed = useMemo(() => buildEvidenceFeed(adapter.normalizedSignals), [adapter]);
  const coverage = useMemo(() => computeSystemicCoverage(adapter.normalizedSignals, adapter, quality), [adapter, quality]);
  const reconstruction = useMemo(
    () => (sessionInput ? reconstructOperationalSession(adapter.normalizedSignals, sessionInput) : null),
    [adapter, sessionInput],
  );

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando sinais operacionais…</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Signal Center</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <ScoreBadge label="Quality" value={quality.scores.signal_quality} />
            <ScoreBadge label="Integrity" value={quality.scores.telemetry_integrity} />
            <ScoreBadge label="Evidence" value={quality.scores.evidence_reliability} />
            <ScoreBadge label="Visibility" value={quality.scores.operational_visibility} />
            <ScoreBadge label="Forensics" value={quality.scores.forensic_completeness} />
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            Cobertura: {adapter.signalCoverage}% · Integridade: {adapter.signalIntegrity}% ·
            Sinais: {adapter.normalizedSignals.length} · Corrompidos: {adapter.corruptedSignals.length} ·
            Faltando: {adapter.missingSignals.length}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="feed">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="feed">Feed</TabsTrigger>
          <TabsTrigger value="quality">Quality</TabsTrigger>
          <TabsTrigger value="coverage">Coverage</TabsTrigger>
          <TabsTrigger value="contradictions">Contradictions</TabsTrigger>
          <TabsTrigger value="visibility">Visibility</TabsTrigger>
          <TabsTrigger value="forensics">Forensics</TabsTrigger>
          <TabsTrigger value="runtime">Runtime</TabsTrigger>
          <TabsTrigger value="integrity">Integrity</TabsTrigger>
        </TabsList>

        <TabsContent value="feed" className="space-y-2">
          <div className="text-xs text-muted-foreground">
            {feed.timeline.length} entradas · {feed.clusters.length} clusters · {feed.confirmations.length} confirmações multi-engine
          </div>
          <div className="max-h-[420px] overflow-auto rounded border divide-y">
            {feed.timeline.slice(0, 100).map((t) => (
              <div key={t.signalId} className="px-3 py-2 text-sm flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-muted-foreground">{new Date(t.at).toISOString().slice(0, 19)}</span>
                <Badge variant="outline">{t.source}</Badge>
                <span className="flex-1 truncate">{t.summary} {t.phase ? `· ${t.phase}` : ''}</span>
                <Badge variant={t.severity === 'high' || t.severity === 'critical' ? 'destructive' : 'secondary'}>
                  {t.severity}
                </Badge>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="quality" className="space-y-2">
          {quality.findings.length === 0 ? (
            <div className="text-sm text-muted-foreground">Sem findings de qualidade.</div>
          ) : (
            quality.findings.map((f) => (
              <Card key={f.id}>
                <CardContent className="py-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-sm">{f.id}</div>
                    <div className="text-xs text-muted-foreground">{f.note}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">×{f.count}</Badge>
                    <Badge variant={f.severity === 'high' || f.severity === 'critical' ? 'destructive' : 'secondary'}>
                      {f.severity}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="coverage" className="space-y-2">
          <Card>
            <CardContent className="py-3 space-y-2 text-sm">
              <div>Áreas cobertas: {coverage.coveredAreas.join(', ') || '—'}</div>
              <div>Sinais fracos: {coverage.weakSignals.join(', ') || '—'}</div>
              <div className="text-red-700">Blind spots: {coverage.blindSpots.join(', ') || '—'}</div>
              <div className="text-amber-700">Zonas instáveis: {coverage.unstableZones.join(', ') || '—'}</div>
              <div className="text-emerald-700">Alta confiança: {coverage.highConfidenceZones.join(', ') || '—'}</div>
              <div className="font-medium">Observability score: {coverage.observabilityScore}</div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contradictions" className="space-y-2">
          {feed.contradictions.length === 0 ? (
            <div className="text-sm text-muted-foreground">Sem contradições detectadas.</div>
          ) : (
            feed.contradictions.map((c, i) => (
              <Card key={i}>
                <CardContent className="py-3 text-sm">
                  <div className="font-medium">{c.reason}</div>
                  <div className="text-xs text-muted-foreground">key: {c.key} · {c.signalIds.length} sinais</div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="visibility" className="space-y-2">
          <Card>
            <CardContent className="py-3 text-sm space-y-2">
              <div>Engines plugados:</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                {Object.entries(integration.byEngine).map(([k, v]) => (
                  <div key={k} className="rounded border px-2 py-1 flex justify-between">
                    <span>{k}</span>
                    <Badge variant="secondary">{v}</Badge>
                  </div>
                ))}
              </div>
              <div className="text-xs text-muted-foreground">
                Total enriquecido: {integration.totalEnriched} · Sem match: {integration.unmatchedSignals}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forensics" className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="session_id para reconstruir"
              value={sessionInput}
              onChange={(e) => setSessionInput(e.target.value.trim())}
            />
            <Button variant="secondary" onClick={() => setSessionInput('')}>Limpar</Button>
          </div>
          {reconstruction && (
            <Card>
              <CardContent className="py-3 text-sm space-y-2">
                <div className="flex gap-2">
                  <Badge>confidence {reconstruction.confidence}</Badge>
                  <Badge>integrity {reconstruction.integrityScore}</Badge>
                  <Badge variant="outline">{reconstruction.reconstructedTimeline.length} entradas</Badge>
                </div>
                <div className="text-xs">
                  Failures prováveis: {reconstruction.probableFailures.length} ·
                  Transições ocultas: {reconstruction.hiddenTransitions.length}
                </div>
                <div className="max-h-[300px] overflow-auto divide-y border rounded">
                  {reconstruction.reconstructedTimeline.map((t) => (
                    <div key={t.signalId} className="px-2 py-1 text-xs flex justify-between">
                      <span className="font-mono">{new Date(t.at).toISOString().slice(11, 19)}</span>
                      <span>{t.summary} · {t.phase}</span>
                      <Badge variant="outline">{t.source}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="runtime" className="space-y-2">
          {feed.hiddenPatterns.length === 0 ? (
            <div className="text-sm text-muted-foreground">Sem hidden patterns.</div>
          ) : (
            feed.hiddenPatterns.map((p, i) => (
              <Card key={i}>
                <CardContent className="py-3 text-sm flex justify-between gap-2">
                  <div>
                    <div className="font-medium">{p.id}</div>
                    <div className="text-xs text-muted-foreground">{p.note}</div>
                  </div>
                  <Badge variant="outline">×{p.count}</Badge>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="integrity" className="space-y-2">
          <Card>
            <CardContent className="py-3 text-sm space-y-1">
              <div>Sinais corrompidos: {adapter.corruptedSignals.length}</div>
              <div className="font-mono text-xs max-h-[200px] overflow-auto">
                {adapter.corruptedSignals.slice(0, 50).join(', ') || '—'}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
