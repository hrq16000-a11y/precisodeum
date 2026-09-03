import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExternalLink, Copy, Download, MapPin, Pencil, RefreshCw, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { NESTED_SERVICE_VERTICALS, SERVICE_VERTICALS, getServiceVertical, buildVerticalSeo } from '@/lib/programmaticServices';
import { SITE_BASE_URL } from '@/hooks/useSeoHead';
import {
  useProgrammaticInventory,
  MIN_CITY_PROVIDERS,
  MIN_NEIGHBORHOOD_PROVIDERS,
  type ProgrammaticPageRow,
} from '@/hooks/useProgrammaticInventory';
import { useProgrammaticOverrides } from '@/lib/seo/programmaticOverrides';
import ProgrammaticOverrideDialog, { type OverrideTarget } from '@/components/admin/ProgrammaticOverrideDialog';
import { reindexSitemaps } from '@/lib/seo/reindexSitemaps';

/**
 * Painel operacional das landings programáticas (/servico/{vertical}/{cidade}
 * e por bairro). A geração continua automática a partir dos profissionais
 * aprovados; aqui o admin cria/edita/remove personalizações (title, meta
 * description, keywords, ativação) e dispara a reindexação do sitemap.
 *
 * Gate anti thin content: cidade >= 1 profissional; bairro >= 2 (igual sitemap).
 */

export function generatedSeoFor(row: ProgrammaticPageRow) {
  const vertical = getServiceVertical(row.vertical);
  if (!vertical) return { title: '', description: '', keywords: '' };
  return buildVerticalSeo(
    vertical,
    {
      cityLabel: row.cityLabel,
      state: row.state || undefined,
      citySlug: row.citySlug,
      neighborhoodLabel: row.neighborhoodLabel,
      neighborhoodSlug: row.neighborhoodSlug,
    },
    row.providers,
  );
}

export default function ProgrammaticPagesTab() {
  const [verticalFilter, setVerticalFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState('all');
  const [dialogTarget, setDialogTarget] = useState<OverrideTarget | null>(null);
  const [reindexing, setReindexing] = useState(false);

  const { data: rows = [], isLoading } = useProgrammaticInventory();
  const { data: overrides = [] } = useProgrammaticOverrides();

  const overrideByPath = useMemo(() => {
    const m = new Map(overrides.map((o) => [o.path, o]));
    return m;
  }, [overrides]);

  const filtered = useMemo(() => rows.filter((r) => (
    (verticalFilter === 'all' || r.vertical === verticalFilter) &&
    (kindFilter === 'all' || r.kind === kindFilter)
  )), [rows, verticalFilter, kindFilter]);

  const exportCsv = () => {
    const header = 'vertical,tipo,local,uf,profissionais,url\n';
    const body = filtered
      .map((r) => [r.verticalLabel, r.kind, `"${r.neighborhoodLabel ? `${r.neighborhoodLabel}, ${r.cityLabel}` : r.cityLabel}"`, r.state || '', r.providers, `${SITE_BASE_URL}${r.path}`].join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([header + body], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'paginas-programaticas.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const copyAll = async () => {
    await navigator.clipboard.writeText(filtered.map((r) => `${SITE_BASE_URL}${r.path}`).join('\n'));
    toast.success(`${filtered.length} URLs copiadas`);
  };

  const openEditor = (r: ProgrammaticPageRow) => {
    const seo = generatedSeoFor(r);
    setDialogTarget({
      path: r.path,
      vertical: r.vertical,
      citySlug: r.citySlug,
      neighborhoodSlug: r.neighborhoodSlug,
      generatedTitle: seo.title,
      generatedDescription: seo.description,
      generatedKeywords: seo.keywords,
    });
  };

  const handleReindex = async () => {
    setReindexing(true);
    await reindexSitemaps();
    setReindexing(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Landings geradas automaticamente a partir dos profissionais aprovados
        ({NESTED_SERVICE_VERTICALS.length + 1} verticais). Cidade exige {MIN_CITY_PROVIDERS}+ profissional
        e bairro {MIN_NEIGHBORHOOD_PROVIDERS}+, o mesmo gate usado no sitemap.
      </p>

      <div className="flex flex-wrap gap-2">
        <Select value={verticalFilter} onValueChange={setVerticalFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as verticais</SelectItem>
            {SERVICE_VERTICALS.map((v) => (
              <SelectItem key={v.slug} value={v.slug}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Cidade e bairro</SelectItem>
            <SelectItem value="cidade">Só cidade</SelectItem>
            <SelectItem value="bairro">Só bairro</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={copyAll} disabled={!filtered.length}>
          <Copy className="mr-1.5 h-4 w-4" /> Copiar URLs
        </Button>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
          <Download className="mr-1.5 h-4 w-4" /> CSV
        </Button>
        <Button variant="outline" size="sm" onClick={handleReindex} disabled={reindexing}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${reindexing ? 'animate-spin' : ''}`} /> Reindexar sitemap
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href="/sitemap?type=services" target="_blank" rel="noreferrer">
            <ExternalLink className="mr-1.5 h-4 w-4" /> Ver sitemap
          </a>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
      ) : !filtered.length ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          Nenhuma página programática elegível com os filtros atuais.
        </CardContent></Card>
      ) : (
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
          {filtered.map((r) => {
            const ov = overrideByPath.get(r.path);
            return (
              <Card key={`${r.vertical}-${r.path}`} className={ov?.enabled === false ? 'opacity-70' : undefined}>
                <CardContent className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{r.verticalLabel}</Badge>
                      <Badge variant={r.kind === 'bairro' ? 'outline' : 'default'}>{r.kind}</Badge>
                      {ov && ov.enabled !== false && <Badge variant="outline">personalizada</Badge>}
                      {ov?.enabled === false && (
                        <Badge variant="destructive" className="gap-1">
                          <EyeOff className="h-3 w-3" /> desativada
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 flex items-center gap-1 truncate text-sm font-medium text-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                      {r.neighborhoodLabel ? `${r.neighborhoodLabel}, ${r.cityLabel}` : r.cityLabel}
                      {r.state ? ` - ${r.state}` : ''}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{r.path}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="text-sm font-semibold text-foreground">{r.providers}</span>
                    <Button variant="ghost" size="icon" onClick={() => openEditor(r)} aria-label={`Editar ${r.path}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" asChild>
                      <a href={r.path} target="_blank" rel="noreferrer" aria-label={`Abrir ${r.path}`}>
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
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
