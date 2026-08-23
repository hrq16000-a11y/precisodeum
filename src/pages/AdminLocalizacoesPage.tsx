/**
 * AdminLocalizacoesPage — /admin/localizacoes
 *
 * Painel de auditoria e gestão dos dados de localização dos prestadores.
 * Lê e atualiza diretamente as colunas `city`, `neighborhood` e `geo_source`
 * da tabela `public.providers` (RLS já permite SELECT/UPDATE para admins
 * via `has_role(auth.uid(), 'admin')`).
 *
 * Não toca no wizard nem altera schema — apenas leitura + UPDATE pontual.
 */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { TablesUpdate } from '@/integrations/supabase/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { MapPin, RefreshCw, Loader2, Pencil, Satellite, Wifi, Hand } from 'lucide-react';
import { toast } from 'sonner';

type GeoSource = 'gps' | 'ip' | 'manual';

interface ProviderRow {
  id: string;
  business_name: string | null;
  city: string | null;
  neighborhood: string | null;
  state: string | null;
  geo_source: string | null;
  updated_at: string | null;
}

const SOURCE_ORDER: Record<string, number> = { manual: 0, ip: 1, gps: 2 };

const sourceBadge = (src: string | null) => {
  if (src === 'gps') {
    return (
      <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white">
        <Satellite className="mr-1 h-3 w-3" aria-hidden /> GPS
      </Badge>
    );
  }
  if (src === 'ip') {
    return (
      <Badge className="bg-amber-500 hover:bg-amber-500 text-white">
        <Wifi className="mr-1 h-3 w-3" aria-hidden /> IP
      </Badge>
    );
  }
  if (src === 'manual') {
    return (
      <Badge className="bg-red-600 hover:bg-red-600 text-white">
        <Hand className="mr-1 h-3 w-3" aria-hidden /> Manual
      </Badge>
    );
  }
  return <Badge variant="outline">—</Badge>;
};

const formatDateTime = (iso: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
};

export default function AdminLocalizacoesPage() {
  const [rows, setRows] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState<'all' | GeoSource>('all');
  const [filterCity, setFilterCity] = useState<string>('all');

  // Modal de edição
  const [editing, setEditing] = useState<ProviderRow | null>(null);
  const [editCity, setEditCity] = useState('');
  const [editNeighborhood, setEditNeighborhood] = useState('');
  const [editSource, setEditSource] = useState<GeoSource>('manual');
  const [saving, setSaving] = useState(false);

  // Listas auxiliares vindas do banco
  const [allCities, setAllCities] = useState<string[]>([]);
  const [editCityOptions, setEditCityOptions] = useState<string[]>([]);
  const [editNeighborhoodOptions, setEditNeighborhoodOptions] = useState<string[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('providers')
        .select('id,business_name,city,neighborhood,state,geo_source,updated_at')
        .order('updated_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      setRows((data as ProviderRow[]) ?? []);
      // Cidades distintas para o filtro
      const cities = Array.from(
        new Set((data ?? []).map((r: any) => r.city).filter((c: any): c is string => !!c && c.trim().length > 0)),
      ).sort((a, b) => a.localeCompare(b, 'pt-BR'));
      setAllCities(cities);
    } catch (err: any) {
      toast.error(`Erro ao carregar prestadores: ${err.message ?? err}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  // Lista filtrada + ordenada (manual → ip → gps)
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (filterSource !== 'all' && r.geo_source !== filterSource) return false;
        if (filterCity !== 'all' && r.city !== filterCity) return false;
        if (term && !(r.business_name ?? '').toLowerCase().includes(term)) return false;
        return true;
      })
      .sort((a, b) => {
        const sa = SOURCE_ORDER[a.geo_source ?? ''] ?? 99;
        const sb = SOURCE_ORDER[b.geo_source ?? ''] ?? 99;
        if (sa !== sb) return sa - sb;
        const da = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const db = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return db - da;
      });
  }, [rows, search, filterSource, filterCity]);

  const counts = useMemo(() => {
    let gps = 0, ip = 0, manual = 0;
    for (const r of rows) {
      if (r.geo_source === 'gps') gps++;
      else if (r.geo_source === 'ip') ip++;
      else if (r.geo_source === 'manual') manual++;
    }
    return { gps, ip, manual };
  }, [rows]);

  // ---------------------------------------------------------------------------
  // Edição
  // ---------------------------------------------------------------------------

  const openEdit = async (row: ProviderRow) => {
    setEditing(row);
    setEditCity(row.city ?? '');
    setEditNeighborhood(row.neighborhood ?? '');
    setEditSource((row.geo_source as GeoSource) ?? 'manual');
    // Cidades disponíveis: mesma fonte usada pelo wizard (tabela `cities`).
    try {
      const { data } = await (supabase as any)
        .from('cities')
        .select('name')
        .order('name', { ascending: true })
        .limit(5000);
      const list = Array.isArray(data)
        ? Array.from(new Set(data.map((c: any) => c.name).filter(Boolean))) as string[]
        : [];
      setEditCityOptions(list.length ? list : allCities);
    } catch {
      setEditCityOptions(allCities);
    }
  };

  // Carrega bairros sempre que a cidade muda no modal
  useEffect(() => {
    if (!editing || !editCity) {
      setEditNeighborhoodOptions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from('neighborhoods')
          .select('name, city')
          .eq('city', editCity)
          .order('name', { ascending: true })
          .limit(2000);
        if (cancelled) return;
        const list = Array.isArray(data)
          ? Array.from(new Set(data.map((n: any) => n.name).filter(Boolean))) as string[]
          : [];
        setEditNeighborhoodOptions(list);
      } catch {
        if (!cancelled) setEditNeighborhoodOptions([]);
      }
    })();
    return () => { cancelled = true; };
  }, [editing, editCity]);

  const closeEdit = () => {
    if (saving) return;
    setEditing(null);
    setEditCityOptions([]);
    setEditNeighborhoodOptions([]);
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editCity.trim()) {
      toast.error('Cidade é obrigatória.');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        city: editCity.trim(),
        neighborhood: editNeighborhood.trim() || null,
        geo_source: editSource,
      };
      const { data, error } = await supabase
        .from('providers')
        .update(payload as TablesUpdate<'providers'>)
        .eq('id', editing.id)
        .select('id,business_name,city,neighborhood,state,geo_source,updated_at')
        .single();
      if (error) throw error;
      // Atualização otimista local — sem reload total
      setRows((prev) => prev.map((r) => (r.id === editing.id ? { ...r, ...(data as ProviderRow) } : r)));
      toast.success('Localização atualizada.');
      setEditing(null);
      setEditCityOptions([]);
      setEditNeighborhoodOptions([]);
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message ?? err}`);
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="container mx-auto py-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <MapPin className="h-6 w-6" aria-hidden /> Localizações dos prestadores
          </h1>
          <p className="text-sm text-muted-foreground">
            Auditoria e correção manual dos campos cidade, bairro e origem da localização.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Atualizar
        </Button>
      </header>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Satellite className="h-4 w-4" aria-hidden /> Total GPS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-emerald-600">{counts.gps}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wifi className="h-4 w-4" aria-hidden /> Total IP
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-600">{counts.ip}</p>
          </CardContent>
        </Card>
        <Card className={counts.manual > 0 ? 'border-red-300' : undefined}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Hand className="h-4 w-4" aria-hidden /> Total Manual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${counts.manual > 0 ? 'text-red-600' : 'text-foreground'}`}>
              {counts.manual}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="loc-search" className="text-xs">Buscar por nome</Label>
              <Input
                id="loc-search"
                placeholder="Nome do prestador..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Origem (geo_source)</Label>
              <Select value={filterSource} onValueChange={(v) => setFilterSource(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="gps">GPS</SelectItem>
                  <SelectItem value="ip">IP</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Cidade</Label>
              <Select value={filterCity} onValueChange={setFilterCity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {allCities.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="py-12 flex items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : visible.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Nenhum prestador encontrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prestador</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Bairro</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Atualizado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.business_name || '—'}</TableCell>
                    <TableCell>
                      {row.city || <span className="text-muted-foreground">—</span>}
                      {row.state ? <span className="text-xs text-muted-foreground"> / {row.state}</span> : null}
                    </TableCell>
                    <TableCell>{row.neighborhood || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{sourceBadge(row.geo_source)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(row.updated_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => void openEdit(row)}>
                        <Pencil className="mr-1 h-3 w-3" aria-hidden /> Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Exibindo {visible.length} de {rows.length} prestadores (limite de leitura: 1000).
          </p>
        </CardContent>
      </Card>

      {/* Modal de edição */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) closeEdit(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar localização</DialogTitle>
            <DialogDescription>
              {editing?.business_name || 'Prestador'} — alterações são auditadas pelo banco.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Cidade</Label>
              {editCityOptions.length > 0 ? (
                <Select value={editCity} onValueChange={(v) => { setEditCity(v); setEditNeighborhood(''); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione a cidade" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {editCityOptions.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={editCity} onChange={(e) => setEditCity(e.target.value)} />
              )}
            </div>

            <div>
              <Label className="text-xs">Bairro</Label>
              {editNeighborhoodOptions.length > 0 ? (
                <Select value={editNeighborhood} onValueChange={setEditNeighborhood}>
                  <SelectTrigger><SelectValue placeholder="Selecione o bairro" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {editNeighborhoodOptions.map((n) => (
                      <SelectItem key={n} value={n}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={editNeighborhood}
                  onChange={(e) => setEditNeighborhood(e.target.value)}
                  placeholder="Digite o bairro"
                />
              )}
            </div>

            <div>
              <Label className="text-xs">Origem (geo_source)</Label>
              <Select value={editSource} onValueChange={(v) => setEditSource(v as GeoSource)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gps">GPS</SelectItem>
                  <SelectItem value="ip">IP</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEdit} disabled={saving}>Cancelar</Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
