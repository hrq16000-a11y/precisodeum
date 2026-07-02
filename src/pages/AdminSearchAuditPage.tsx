import { useMemo, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw, Search as SearchIcon } from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { useCategories, useSearchAuditComparison } from '@/hooks/useProviders';
import { useGeoCity } from '@/hooks/useGeoCity';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AdminSearchAuditPage() {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { city: geoCity, state: geoState, latitude, longitude, radiusKm } = useGeoCity();
  const [queryDraft, setQueryDraft] = useState('baba');
  const [cityDraft, setCityDraft] = useState(geoCity || 'São José dos Pinhais');
  const [categoryDraft, setCategoryDraft] = useState('all');
  const [submitted, setSubmitted] = useState({ query: 'baba', city: geoCity || 'São José dos Pinhais', category: '' });

  const { data: categories = [] } = useCategories();
  const audit = useSearchAuditComparison(
    submitted.query,
    submitted.city,
    submitted.category,
    0,
    geoState || '',
    latitude,
    longitude,
    radiusKm,
  );

  const rows = audit.data?.auditEntries || [];
  const summary = useMemo(() => ({
    total: rows.length,
    corrected: rows.filter((row) => row.distanceAudit.source === 'city-center').length,
    suspicious: rows.filter((row) => row.distanceAudit.suspicious).length,
    moved: rows.filter((row) => row.beforeRank !== row.afterRank).length,
  }), [rows]);

  if (adminLoading) {
    return <AdminLayout><div className="flex items-center justify-center p-12 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando permissões…</div></AdminLayout>;
  }
  if (!isAdmin) return null;

  return (
    <AdminLayout>
      <div className="container mx-auto max-w-7xl space-y-4 p-4">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Auditoria da busca híbrida</h1>
            <p className="text-sm text-muted-foreground">Compare ranking anterior vs. ranking híbrido e veja o motivo textual, geográfico e de distância auditada.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => audit.refetch()} disabled={audit.isFetching}>
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${audit.isFetching ? 'animate-spin' : ''}`} /> Recarregar
          </Button>
        </header>

        <Card className="p-4">
          <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-end">
            <div>
              <Label className="text-xs text-muted-foreground">Query</Label>
              <Input value={queryDraft} onChange={(e) => setQueryDraft(e.target.value)} placeholder="Ex.: baba, diarista, pedreiro" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Cidade base</Label>
              <Input value={cityDraft} onChange={(e) => setCityDraft(e.target.value)} placeholder="Ex.: São José dos Pinhais" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Categoria</Label>
              <Select value={categoryDraft || 'all'} onValueChange={setCategoryDraft}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories.map((category: any) => (
                    <SelectItem key={category.id} value={category.slug}>{category.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setSubmitted({ query: queryDraft.trim(), city: cityDraft.trim(), category: categoryDraft === 'all' ? '' : categoryDraft })}>
              <SearchIcon className="mr-2 h-4 w-4" /> Auditar
            </Button>
          </div>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="p-3"><div className="text-sm text-muted-foreground">Resultados</div><div className="text-2xl font-bold text-foreground">{summary.total}</div></Card>
          <Card className="p-3"><div className="text-sm text-muted-foreground">Distância corrigida</div><div className="text-2xl font-bold text-foreground">{summary.corrected}</div></Card>
          <Card className="p-3"><div className="text-sm text-muted-foreground">Coords suspeitas</div><div className="text-2xl font-bold text-foreground">{summary.suspicious}</div></Card>
          <Card className="p-3"><div className="text-sm text-muted-foreground">Mudaram de posição</div><div className="text-2xl font-bold text-foreground">{summary.moved}</div></Card>
        </div>

        <Card className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-2 py-2">Prestador</th>
                <th className="px-2 py-2">Antes</th>
                <th className="px-2 py-2">Depois</th>
                <th className="px-2 py-2">Texto</th>
                <th className="px-2 py-2">Distância</th>
                <th className="px-2 py-2">Fonte</th>
                <th className="px-2 py-2">Motivos</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.provider.id} className="border-t border-border align-top">
                  <td className="px-2 py-2">
                    <div className="font-semibold text-foreground">{row.provider.name}</div>
                    <div className="text-muted-foreground">{row.provider.category} · {row.provider.city}</div>
                  </td>
                  <td className="px-2 py-2 font-mono">#{row.beforeRank}</td>
                  <td className="px-2 py-2 font-mono">#{row.afterRank}</td>
                  <td className="px-2 py-2 font-mono">{row.textRel.toFixed(2)}</td>
                  <td className="px-2 py-2 font-mono">{Number.isFinite(row.distanceKm) ? `${row.distanceKm.toFixed(1)} km` : 'N/A'}</td>
                  <td className="px-2 py-2">
                    <span className="inline-flex rounded-full border border-border bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {row.distanceAudit.source}
                    </span>
                    {row.distanceAudit.suspicious && (
                      <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-foreground">
                        <AlertTriangle className="h-3 w-3" /> suspeita
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">{row.reasons.join(' · ')}</td>
                </tr>
              ))}
              {!audit.isLoading && rows.length === 0 && (
                <tr><td colSpan={7} className="px-2 py-8 text-center text-muted-foreground">Nenhum resultado para essa combinação.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </AdminLayout>
  );
}