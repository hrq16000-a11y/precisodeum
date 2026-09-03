/**
 * Aba "Palavras-chave locais" de /admin/seo.
 *
 * Tabela única cruzando cidade x vertical a partir do inventário de páginas
 * programáticas (somente cidades com profissionais aprovados). Para cada par
 * mostra as palavras-chave sugeridas, as pautas editoriais e a landing já
 * gerada, com export CSV global e reindexação do sitemap.
 *
 * 100% determinístico (sem IA): mesma base -> mesma saída.
 */

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, Copy, Download, ExternalLink, Lightbulb, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { SERVICE_VERTICALS, getServiceVertical } from '@/lib/programmaticServices';
import { useProgrammaticInventory } from '@/hooks/useProgrammaticInventory';
import { buildLocalKeywords, buildContentIdeas } from '@/lib/seo/localKeywordIdeas';
import { reindexSitemaps } from '@/lib/seo/reindexSitemaps';

interface PairRow {
  key: string;
  verticalSlug: string;
  verticalLabel: string;
  cityLabel: string;
  citySlug: string;
  state: string | null;
  providers: number;
  path: string;
  neighborhoods: string[];
}

export default function LocalKeywordsTab() {
  const { data: rows = [], isLoading } = useProgrammaticInventory();
  const [term, setTerm] = useState('');
  const [reindexing, setReindexing] = useState(false);

  const pairs = useMemo<PairRow[]>(() => {
    const out: PairRow[] = [];
    for (const v of SERVICE_VERTICALS) {
      const cityRows = rows.filter((r) => r.vertical === v.slug && r.kind === 'cidade');
      for (const c of cityRows) {
        out.push({
          key: `${v.slug}|${c.citySlug}`,
          verticalSlug: v.slug,
          verticalLabel: v.label,
          cityLabel: c.cityLabel,
          citySlug: c.citySlug,
          state: c.state,
          providers: c.providers,
          path: c.path,
          neighborhoods: rows
            .filter((r) => r.vertical === v.slug && r.kind === 'bairro' && r.citySlug === c.citySlug)
            .map((r) => r.neighborhoodLabel || '')
            .filter(Boolean),
        });
      }
    }
    return out.sort((a, b) => b.providers - a.providers || a.cityLabel.localeCompare(b.cityLabel));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return pairs;
    return pairs.filter(
      (p) =>
        p.cityLabel.toLowerCase().includes(q) ||
        p.verticalLabel.toLowerCase().includes(q) ||
        (p.state || '').toLowerCase().includes(q),
    );
  }, [pairs, term]);

  const buildFor = (p: PairRow) => {
    const vertical = getServiceVertical(p.verticalSlug);
    if (!vertical) return { keywords: [], ideas: [] };
    const input = {
      vertical: {
        slug: vertical.slug,
        label: vertical.label,
        inlineLabel: vertical.inlineLabel,
        keywordSeeds: vertical.keywordSeeds,
      },
      cityLabel: p.cityLabel,
      state: p.state,
      neighborhoodLabels: p.neighborhoods,
      providerCount: p.providers,
    };
    return { keywords: buildLocalKeywords(input), ideas: buildContentIdeas(input) };
  };

  const exportCsv = () => {
    const header = 'vertical,cidade,uf,profissionais,pagina,palavra_chave,intencao,prioridade\n';
    const body = filtered
      .flatMap((p) =>
        buildFor(p).keywords.map((k) =>
          [
            p.verticalLabel,
            `"${p.cityLabel}"`,
            p.state || '',
            p.providers,
            p.path,
            `"${k.keyword}"`,
            k.intent,
            k.priority,
          ].join(','),
        ),
      )
      .join('\n');
    const url = URL.createObjectURL(new Blob([header + body], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'palavras-chave-locais.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado');
  };

  const handleReindex = async () => {
    setReindexing(true);
    await reindexSitemaps();
    setReindexing(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Filtrar por cidade, UF ou vertical"
          className="w-[280px]"
        />
        <Badge variant="secondary">{filtered.length} pares cidade x vertical</Badge>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="mr-1.5 h-4 w-4" /> CSV
          </Button>
          <Button size="sm" onClick={handleReindex} disabled={reindexing}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${reindexing ? 'animate-spin' : ''}`} aria-hidden />
            Reindexar sitemap
          </Button>
        </div>
      </div>

      {!filtered.length ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma cidade com profissional aprovado nas verticais programáticas.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const { keywords, ideas } = buildFor(p);
            return (
              <Collapsible key={p.key}>
                <Card>
                  <CardHeader className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base">
                        {p.verticalLabel} · {p.cityLabel}
                        {p.state ? ` - ${p.state}` : ''}
                      </CardTitle>
                      <Badge variant="outline">{p.providers} prof.</Badge>
                      {p.neighborhoods.length > 0 && (
                        <Badge variant="secondary">{p.neighborhoods.length} bairros</Badge>
                      )}
                      <Badge>{keywords.length} keywords</Badge>
                      <div className="ml-auto flex items-center gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <a href={p.path} target="_blank" rel="noreferrer">
                            <ExternalLink className="mr-1.5 h-4 w-4" /> Página
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            await navigator.clipboard.writeText(
                              keywords.map((k) => k.keyword).join('\n'),
                            );
                            toast.success(`${keywords.length} palavras-chave copiadas`);
                          }}
                        >
                          <Copy className="mr-1.5 h-4 w-4" /> Copiar
                        </Button>
                        <CollapsibleTrigger asChild>
                          <Button variant="outline" size="sm">
                            Detalhes <ChevronDown className="ml-1.5 h-4 w-4" aria-hidden />
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                    </div>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">
                          Palavras-chave
                        </p>
                        {keywords.map((k) => (
                          <div
                            key={k.keyword}
                            className="flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5"
                          >
                            <span className="truncate text-sm text-foreground">{k.keyword}</span>
                            <div className="flex shrink-0 items-center gap-2">
                              <Badge variant="outline">{k.intent}</Badge>
                              <span className="text-xs font-semibold text-muted-foreground">
                                {k.priority}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">
                          Pautas de conteúdo
                        </p>
                        {ideas.map((idea) => (
                          <div key={idea.title} className="rounded-lg border p-3">
                            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                              <Lightbulb className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                              {idea.title}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">{idea.angle}</p>
                            <Badge variant="secondary" className="mt-2">
                              {idea.intent}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}
