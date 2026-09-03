import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Pencil, ExternalLink, RefreshCw } from 'lucide-react';
import { useProgrammaticInventory } from '@/hooks/useProgrammaticInventory';
import { useProgrammaticOverrides, applyOverrideToSeo } from '@/lib/seo/programmaticOverrides';
import ProgrammaticOverrideDialog, { type OverrideTarget } from '@/components/admin/ProgrammaticOverrideDialog';
import { generatedSeoFor } from '@/components/admin/ProgrammaticPagesTab';
import { reindexSitemaps } from '@/lib/seo/reindexSitemaps';
import { SITE_BASE_URL } from '@/hooks/useSeoHead';
import { getServiceVertical } from '@/lib/programmaticServices';

/**
 * Metadados das landings programáticas: title, meta description e o JSON-LD
 * efetivo de cada URL, com edição imediata (o override é lido pela página
 * pública, então o JSON-LD e as metas mudam sem novo deploy).
 */
function buildJsonLdPreview(row: { cityLabel: string; neighborhoodLabel: string | null; state: string | null; vertical: string; providers: number; path: string }, description: string) {
  const v = getServiceVertical(row.vertical);
  const local = row.neighborhoodLabel ? `${row.neighborhoodLabel}, ${row.cityLabel}` : row.cityLabel;
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `${v?.label ?? row.vertical} em ${local}`,
    serviceType: v?.label ?? row.vertical,
    description,
    areaServed: {
      '@type': row.neighborhoodLabel ? 'Place' : 'City',
      name: local,
      address: {
        '@type': 'PostalAddress',
        ...(row.neighborhoodLabel ? { streetAddress: row.neighborhoodLabel } : {}),
        addressLocality: row.cityLabel,
        addressRegion: row.state || undefined,
        addressCountry: 'BR',
      },
    },
    provider: { '@type': 'Organization', name: 'Preciso de um', url: SITE_BASE_URL },
    offers: v
      ? {
          '@type': 'AggregateOffer',
          priceCurrency: 'BRL',
          lowPrice: v.priceRange.low,
          highPrice: v.priceRange.high,
          offerCount: row.providers || undefined,
        }
      : undefined,
    url: `${SITE_BASE_URL}${row.path}`,
  };
}

export default function ProgrammaticSeoTab() {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dialogTarget, setDialogTarget] = useState<OverrideTarget | null>(null);
  const [reindexing, setReindexing] = useState(false);

  const { data: rows = [], isLoading } = useProgrammaticInventory();
  const { data: overrides = [] } = useProgrammaticOverrides();
  const overrideByPath = useMemo(() => new Map(overrides.map((o) => [o.path, o])), [overrides]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows.slice(0, 200);
    return rows
      .filter((r) => `${r.path} ${r.cityLabel} ${r.neighborhoodLabel || ''} ${r.verticalLabel}`.toLowerCase().includes(q))
      .slice(0, 200);
  }, [rows, search]);

  const handleReindex = async () => {
    setReindexing(true);
    await reindexSitemaps();
    setReindexing(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          placeholder="Buscar por cidade, bairro ou vertical"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button variant="outline" size="sm" onClick={handleReindex} disabled={reindexing}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${reindexing ? 'animate-spin' : ''}`} /> Reindexar sitemap
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
      ) : !filtered.length ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          Nenhuma landing programática encontrada.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const ov = overrideByPath.get(r.path) || null;
            const seo = applyOverrideToSeo(generatedSeoFor(r), ov);
            const isOpen = expanded === r.path;
            return (
              <Card key={r.path}>
                <CardContent className="space-y-2 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{r.verticalLabel}</Badge>
                        <Badge variant={r.kind === 'bairro' ? 'outline' : 'default'}>{r.kind}</Badge>
                        {ov && <Badge variant="outline">{ov.enabled === false ? 'desativada' : 'personalizada'}</Badge>}
                      </div>
                      <p className="truncate text-sm font-semibold text-foreground">{seo.title}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{seo.description}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.path}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Editar SEO de ${r.path}`}
                        onClick={() => {
                          const gen = generatedSeoFor(r);
                          setDialogTarget({
                            path: r.path,
                            vertical: r.vertical,
                            citySlug: r.citySlug,
                            neighborhoodSlug: r.neighborhoodSlug,
                            generatedTitle: gen.title,
                            generatedDescription: gen.description,
                            generatedKeywords: gen.keywords,
                          });
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" asChild>
                        <a href={r.path} target="_blank" rel="noreferrer" aria-label={`Abrir ${r.path}`}>
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </div>

                  <Button variant="ghost" size="sm" onClick={() => setExpanded(isOpen ? null : r.path)}>
                    {isOpen ? 'Ocultar JSON-LD' : 'Ver JSON-LD'}
                  </Button>
                  {isOpen && (
                    <pre className="max-h-72 overflow-auto rounded-lg bg-muted p-3 text-[11px] leading-relaxed">
                      {JSON.stringify(buildJsonLdPreview(r, seo.description), null, 2)}
                    </pre>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ProgrammaticOverrideDialog
        open={!!dialogTarget}
        onOpenChange={(v) => { if (!v) setDialogTarget(null); }}
        target={dialogTarget}
        current={dialogTarget ? overrideByPath.get(dialogTarget.path) || null : null}
      />
    </div>
  );
}
