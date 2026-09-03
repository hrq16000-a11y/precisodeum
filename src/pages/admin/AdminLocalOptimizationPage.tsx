import { useMemo, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Download, Lightbulb } from 'lucide-react';
import { toast } from 'sonner';
import { SERVICE_VERTICALS, getServiceVertical } from '@/lib/programmaticServices';
import { useProgrammaticInventory } from '@/hooks/useProgrammaticInventory';
import { buildLocalKeywords, buildContentIdeas } from '@/lib/seo/localKeywordIdeas';

/**
 * /admin/otimizacao-local — palavras-chave locais sugeridas por cidade e
 * vertical + pautas editoriais para as landings programáticas.
 * Tudo determinístico (sem IA), derivado das cidades com profissionais reais.
 */
export default function AdminLocalOptimizationPage() {
  const { data: rows = [], isLoading } = useProgrammaticInventory();
  const [verticalSlug, setVerticalSlug] = useState(SERVICE_VERTICALS[0]?.slug || '');
  const [citySlug, setCitySlug] = useState<string>('');

  const cities = useMemo(() => {
    const map = new Map<string, { slug: string; label: string; state: string | null; providers: number }>();
    rows
      .filter((r) => r.vertical === verticalSlug && r.kind === 'cidade')
      .forEach((r) => map.set(r.citySlug, { slug: r.citySlug, label: r.cityLabel, state: r.state, providers: r.providers }));
    return [...map.values()].sort((a, b) => b.providers - a.providers);
  }, [rows, verticalSlug]);

  const activeCity = cities.find((c) => c.slug === citySlug) || cities[0] || null;

  const neighborhoods = useMemo(() => rows
    .filter((r) => r.vertical === verticalSlug && r.kind === 'bairro' && r.citySlug === activeCity?.slug)
    .map((r) => r.neighborhoodLabel || '')
    .filter(Boolean), [rows, verticalSlug, activeCity?.slug]);

  const vertical = getServiceVertical(verticalSlug);

  const input = vertical && activeCity
    ? {
        vertical: { slug: vertical.slug, label: vertical.label, inlineLabel: vertical.inlineLabel, keywordSeeds: vertical.keywordSeeds },
        cityLabel: activeCity.label,
        state: activeCity.state,
        neighborhoodLabels: neighborhoods,
        providerCount: activeCity.providers,
      }
    : null;

  const keywords = useMemo(() => (input ? buildLocalKeywords(input) : []), [input]);
  const ideas = useMemo(() => (input ? buildContentIdeas(input) : []), [input]);

  const copyKeywords = async () => {
    await navigator.clipboard.writeText(keywords.map((k) => k.keyword).join('\n'));
    toast.success(`${keywords.length} palavras-chave copiadas`);
  };

  const exportCsv = () => {
    const header = 'palavra_chave,intencao,prioridade\n';
    const body = keywords.map((k) => [`"${k.keyword}"`, k.intent, k.priority].join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([header + body], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `keywords-${verticalSlug}-${activeCity?.slug || 'geral'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Otimização local</h1>
          <p className="text-sm text-muted-foreground">
            Palavras-chave e pautas por cidade e vertical, geradas a partir das cidades
            que já têm profissionais aprovados.
          </p>
        </header>

        <div className="flex flex-wrap gap-2">
          <Select value={verticalSlug} onValueChange={(v) => { setVerticalSlug(v); setCitySlug(''); }}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SERVICE_VERTICALS.map((v) => (
                <SelectItem key={v.slug} value={v.slug}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={activeCity?.slug || ''} onValueChange={setCitySlug} disabled={!cities.length}>
            <SelectTrigger className="w-[260px]"><SelectValue placeholder="Cidade" /></SelectTrigger>
            <SelectContent>
              {cities.map((c) => (
                <SelectItem key={c.slug} value={c.slug}>
                  {c.label}{c.state ? ` - ${c.state}` : ''} ({c.providers})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={copyKeywords} disabled={!keywords.length}>
            <Copy className="mr-1.5 h-4 w-4" /> Copiar
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!keywords.length}>
            <Download className="mr-1.5 h-4 w-4" /> CSV
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
        ) : !activeCity ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
            Ainda não há cidade com profissional aprovado nesta vertical.
          </CardContent></Card>
        ) : (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
            <Card>
              <CardHeader><CardTitle className="text-base">Palavras-chave locais ({keywords.length})</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {keywords.map((k) => (
                  <div key={k.keyword} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5">
                    <span className="truncate text-sm text-foreground">{k.keyword}</span>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="outline">{k.intent}</Badge>
                      <span className="text-xs font-semibold text-muted-foreground">{k.priority}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Pautas de conteúdo</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {ideas.map((idea) => (
                  <div key={idea.title} className="rounded-lg border p-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Lightbulb className="h-4 w-4 shrink-0 text-primary" /> {idea.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{idea.angle}</p>
                    <Badge variant="secondary" className="mt-2">{idea.intent}</Badge>
                  </div>
                ))}
                {neighborhoods.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Bairros elegíveis nesta cidade: {neighborhoods.slice(0, 12).join(', ')}.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
