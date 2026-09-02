import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExternalLink, Copy, Download, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import {
  NESTED_SERVICE_VERTICALS,
  SERVICE_VERTICALS,
  verticalCityPath,
  verticalNeighborhoodPath,
} from '@/lib/programmaticServices';
import { slugifyNeighborhood } from '@/lib/handymanServiceContent';
import { sanitizeSlug } from '@/lib/slugify';
import { SITE_BASE_URL } from '@/hooks/useSeoHead';

/**
 * Painel operacional das landings programáticas (/servico/{vertical}/{cidade}
 * e por bairro). As páginas são geradas automaticamente a partir dos
 * profissionais aprovados — este painel mostra exatamente quais URLs existem
 * hoje, quantos profissionais sustentam cada uma e permite exportar a lista.
 *
 * Gate anti thin content: cidade precisa de >= 1 profissional; bairro, >= 2
 * (mesmo critério aplicado no sitemap).
 */

const MIN_CITY = 1;
const MIN_NEIGHBORHOOD = 2;

interface Row {
  vertical: string;
  verticalLabel: string;
  cityLabel: string;
  citySlug: string;
  state: string | null;
  providers: number;
  path: string;
  kind: 'cidade' | 'bairro';
}

export default function ProgrammaticPagesTab() {
  const [verticalFilter, setVerticalFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState('all');

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['admin-programmatic-pages'],
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<Row[]> => {
      const { data: cats } = await supabase.from('categories').select('id, slug');
      const catBySlug = new Map<string, string>();
      (cats || []).forEach((c: any) => catBySlug.set(c.slug, c.id));

      const out: Row[] = [];
      for (const v of SERVICE_VERTICALS) {
        const ids = v.categorySlugs.map((s) => catBySlug.get(s)).filter(Boolean) as string[];
        if (!ids.length) continue;
        const { data } = await supabase
          .from('providers')
          .select('city, state, neighborhood')
          .in('category_id', ids)
          .eq('status', 'approved')
          .limit(2000);

        const cityMap = new Map<string, { label: string; state: string | null; count: number }>();
        const hoodMap = new Map<string, { cityLabel: string; citySlug: string; label: string; state: string | null; count: number }>();

        (data || []).forEach((p: any) => {
          const cityLabel = (p.city || '').trim();
          if (!cityLabel) return;
          const citySlug = sanitizeSlug(cityLabel);
          if (!citySlug) return;
          const cur = cityMap.get(citySlug) || { label: cityLabel, state: p.state || null, count: 0 };
          cur.count += 1;
          cityMap.set(citySlug, cur);

          const hoodLabel = (p.neighborhood || '').trim();
          if (!hoodLabel || hoodLabel.toLowerCase() === cityLabel.toLowerCase()) return;
          const hoodSlug = slugifyNeighborhood(hoodLabel);
          if (!hoodSlug) return;
          const hk = `${citySlug}|${hoodSlug}`;
          const h = hoodMap.get(hk) || { cityLabel, citySlug, label: hoodLabel, state: p.state || null, count: 0 };
          h.count += 1;
          hoodMap.set(hk, h);
        });

        cityMap.forEach((c, citySlug) => {
          if (c.count < MIN_CITY) return;
          out.push({
            vertical: v.slug, verticalLabel: v.label, cityLabel: c.label, citySlug,
            state: c.state, providers: c.count, kind: 'cidade',
            path: verticalCityPath(v, citySlug),
          });
        });
        hoodMap.forEach((h, key) => {
          if (h.count < MIN_NEIGHBORHOOD) return;
          const hoodSlug = key.split('|')[1];
          out.push({
            vertical: v.slug, verticalLabel: v.label,
            cityLabel: `${h.label}, ${h.cityLabel}`, citySlug: h.citySlug,
            state: h.state, providers: h.count, kind: 'bairro',
            path: verticalNeighborhoodPath(v, h.citySlug, hoodSlug),
          });
        });
      }
      return out.sort((a, b) => b.providers - a.providers);
    },
  });

  const filtered = useMemo(() => rows.filter((r) => (
    (verticalFilter === 'all' || r.vertical === verticalFilter) &&
    (kindFilter === 'all' || r.kind === kindFilter)
  )), [rows, verticalFilter, kindFilter]);

  const exportCsv = () => {
    const header = 'vertical,tipo,local,uf,profissionais,url\n';
    const body = filtered
      .map((r) => [r.verticalLabel, r.kind, `"${r.cityLabel}"`, r.state || '', r.providers, `${SITE_BASE_URL}${r.path}`].join(','))
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

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Landings geradas automaticamente a partir dos profissionais aprovados
        ({NESTED_SERVICE_VERTICALS.length + 1} verticais). Cidade exige {MIN_CITY}+ profissional
        e bairro {MIN_NEIGHBORHOOD}+, o mesmo gate usado no sitemap.
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
          {filtered.map((r) => (
            <Card key={`${r.vertical}-${r.path}`}>
              <CardContent className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{r.verticalLabel}</Badge>
                    <Badge variant={r.kind === 'bairro' ? 'outline' : 'default'}>{r.kind}</Badge>
                  </div>
                  <p className="mt-1 flex items-center gap-1 truncate text-sm font-medium text-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" /> {r.cityLabel}{r.state ? ` - ${r.state}` : ''}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{r.path}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{r.providers}</span>
                  <Button variant="ghost" size="icon" asChild>
                    <a href={r.path} target="_blank" rel="noreferrer" aria-label={`Abrir ${r.path}`}>
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
