import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Save, RotateCcw, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  computeProviderScore,
  DEFAULT_SCORE_WEIGHTS,
  type SearchScoreWeights,
  type SortMode,
} from '@/lib/searchFilters';
import { useQueryClient } from '@tanstack/react-query';

type SortChoice = Extract<SortMode, 'relevance' | 'best' | 'nearest' | 'rating' | 'reviews' | 'experience'>;
const SORT_OPTIONS: { value: SortChoice; label: string; help: string }[] = [
  { value: 'best', label: 'Melhor combinação', help: 'Score híbrido (rating + distância)' },
  { value: 'rating', label: 'Avaliação', help: 'Maior nota primeiro' },
  { value: 'nearest', label: 'Mais próximo', help: 'Distância (requer GPS)' },
  { value: 'reviews', label: 'Mais avaliações', help: 'Volume de reviews' },
  { value: 'experience', label: 'Mais experiência', help: 'Anos de atuação' },
  { value: 'relevance', label: 'Relevância', help: 'Padrão antigo (sem ordenação especial)' },
];

const PREVIEW_PROVIDERS = [
  { name: 'Profissional A', rating: 4.9, distanceKm: 12 },
  { name: 'Profissional B', rating: 4.6, distanceKm: 2 },
  { name: 'Profissional C', rating: 4.2, distanceKm: 0.8 },
  { name: 'Profissional D', rating: 5.0, distanceKm: 35 },
];

function parseWeights(raw: string | null): SearchScoreWeights {
  if (!raw) return { ...DEFAULT_SCORE_WEIGHTS };
  try {
    const j = JSON.parse(raw);
    const r = Number(j.rating);
    const d = Number(j.distance);
    if (Number.isFinite(r) && Number.isFinite(d) && r + d > 0) {
      return { rating: r, distance: d };
    }
  } catch { /* noop */ }
  return { ...DEFAULT_SCORE_WEIGHTS };
}

export default function AdminSearchSortingPage() {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [defaultSort, setDefaultSort] = useState<SortChoice>('best');
  const [weights, setWeights] = useState<SearchScoreWeights>({ ...DEFAULT_SCORE_WEIGHTS });
  const [initial, setInitial] = useState<{ sort: SortChoice; weights: SearchScoreWeights }>({
    sort: 'best',
    weights: { ...DEFAULT_SCORE_WEIGHTS },
  });

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('site_settings')
        .select('key, value')
        .in('key', ['default_search_sort', 'search_score_weights']);
      const map = Object.fromEntries((data || []).map((r: any) => [r.key, r.value]));
      const sort = (map.default_search_sort as SortChoice) || 'best';
      const w = parseWeights(map.search_score_weights ?? null);
      setDefaultSort(sort);
      setWeights(w);
      setInitial({ sort, weights: w });
      setLoading(false);
    })();
  }, []);

  // Slider 0..100 representa o percentual de RATING; distância é 100 - rating.
  const ratingPct = useMemo(() => {
    const total = weights.rating + weights.distance || 1;
    return Math.round((weights.rating / total) * 100);
  }, [weights]);
  const distancePct = 100 - ratingPct;

  const onRatingPctChange = (pct: number) => {
    const clamped = Math.max(0, Math.min(100, pct));
    setWeights({ rating: clamped / 100, distance: (100 - clamped) / 100 });
  };

  const previewSorted = useMemo(() => {
    return [...PREVIEW_PROVIDERS]
      .map((p) => ({ ...p, score: computeProviderScore(p, weights) }))
      .sort((a, b) => b.score - a.score);
  }, [weights]);

  const dirty =
    initial.sort !== defaultSort ||
    initial.weights.rating !== weights.rating ||
    initial.weights.distance !== weights.distance;

  const reset = () => {
    setDefaultSort('best');
    setWeights({ ...DEFAULT_SCORE_WEIGHTS });
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = [
        { key: 'default_search_sort', value: defaultSort },
        {
          key: 'search_score_weights',
          value: JSON.stringify({
            rating: Number(weights.rating.toFixed(3)),
            distance: Number(weights.distance.toFixed(3)),
          }),
        },
      ];
      const { error } = await supabase
        .from('site_settings')
        .upsert(payload, { onConflict: 'key' });
      if (error) throw error;
      setInitial({ sort: defaultSort, weights: { ...weights } });
      qc.invalidateQueries({ queryKey: ['site-settings'] });
      toast.success('Configuração salva. Já vale para novas buscas.');
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 text-sm text-muted-foreground">Carregando…</div>
    );
  }

  useEffect(() => {
    const prev = document.title;
    document.title = 'Ordenação da busca · Admin';
    return () => { document.title = prev; };
  }, []);

  return (
    <>
      <div className="container mx-auto max-w-4xl space-y-6 p-4 sm:p-6">

        <header className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Sparkles className="h-6 w-6 text-primary" strokeWidth={1.75} aria-hidden />
            Ordenação da busca
          </h1>
          <p className="text-sm text-muted-foreground">
            Ajuste o critério padrão e os pesos do score híbrido (rating × distância) usados em
            <code className="mx-1 rounded bg-muted px-1 text-xs">/buscar</code>.
            Vale para todas as categorias e cidades. Usuários podem sobrescrever via{' '}
            <code className="rounded bg-muted px-1 text-xs">?ordem=</code>.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Ordenação padrão</CardTitle>
            <CardDescription>
              Aplicada quando o usuário não escolhe um critério explicitamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Label htmlFor="default-sort">Critério padrão</Label>
            <Select value={defaultSort} onValueChange={(v) => setDefaultSort(v as SortChoice)}>
              <SelectTrigger id="default-sort" className="max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    <span className="font-medium">{o.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground">— {o.help}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Alert>
              <Info className="h-4 w-4" aria-hidden />
              <AlertDescription className="text-xs">
                Se o usuário tem GPS ativo e o padrão é <strong>relevance</strong>, a busca usa{' '}
                <strong>“Melhor combinação”</strong> automaticamente como upgrade.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pesos de “Melhor combinação”</CardTitle>
            <CardDescription>
              Quanto rating e distância contam no score híbrido. Soma sempre 100%.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <Label>Avaliação (rating)</Label>
                <span className="font-mono font-semibold">{ratingPct}%</span>
              </div>
              <Slider
                value={[ratingPct]}
                min={0}
                max={100}
                step={5}
                onValueChange={(v) => onRatingPctChange(v[0])}
                aria-label="Peso da avaliação"
              />
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Distância</span>
                <span className="font-mono font-semibold">{distancePct}%</span>
              </div>
              {/* Barra de proporção visual */}
              <div className="flex h-3 w-full overflow-hidden rounded-full border">
                <div
                  className="bg-primary transition-all"
                  style={{ width: `${ratingPct}%` }}
                  aria-hidden
                />
                <div
                  className="bg-secondary transition-all"
                  style={{ width: `${distancePct}%` }}
                  aria-hidden
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Recomendado: rating ≥ 60% (anti-leilão de preços, prioriza qualidade).
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Prévia · ordenação resultante</h3>
              <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3">
                {previewSorted.map((p, i) => {
                  const pct = Math.round(p.score * 100);
                  return (
                    <div
                      key={p.name}
                      className="flex items-center gap-3 rounded bg-background px-3 py-2 text-sm"
                    >
                      <span className="w-5 text-center font-mono font-bold text-muted-foreground">
                        {i + 1}
                      </span>
                      <span className="flex-1 truncate font-medium">{p.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ★ {p.rating.toFixed(1)} · {p.distanceKm} km
                      </span>
                      <span className="inline-flex w-12 justify-center rounded-full bg-primary/95 px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                        {pct}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={!dirty || saving} className="gap-2">
            <Save className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            {saving ? 'Salvando…' : 'Salvar configuração'}
          </Button>
          <Button variant="outline" onClick={reset} disabled={saving} className="gap-2">
            <RotateCcw className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Restaurar padrão (70/30)
          </Button>
          {dirty && (
            <span className="text-xs text-muted-foreground">Alterações não salvas.</span>
          )}
        </div>
      </div>
    </>
  );
}
