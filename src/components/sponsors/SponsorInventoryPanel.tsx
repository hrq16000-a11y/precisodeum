import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, TrendingUp, X } from 'lucide-react';

// Helper local de normalização — espelha public.normalize_slug do banco
const normalizeSlug = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');

// Fase 1.3 — Painel de inventário e forecast simples (admin-only)

type InventoryRow = {
  slot_slug: string;
  city: string;
  category: string;
  active_sponsors: number;
  max_capacity: number;
  available_slots: number;
  occupancy_rate: number;
  status: 'available' | 'moderate' | 'saturated';
};

type ForecastRow = {
  slot_slug: string;
  city: string;
  category: string;
  active_sponsors: number;
  ending_soon: number;
  avg_new_per_day: number;
  projected_active: number;
  max_capacity: number;
  projected_occupancy_rate: number;
  forecast: 'comfortable' | 'tight' | 'will_saturate';
};

const statusVariant: Record<InventoryRow['status'], 'default' | 'secondary' | 'destructive'> = {
  available: 'secondary',
  moderate: 'default',
  saturated: 'destructive',
};

const forecastVariant: Record<ForecastRow['forecast'], 'default' | 'secondary' | 'destructive'> = {
  comfortable: 'secondary',
  tight: 'default',
  will_saturate: 'destructive',
};

const formatScope = (city: string, category: string) => {
  const c = city === '_any' ? 'todas as cidades' : city;
  const k = category === '_any' ? 'todas as categorias' : category;
  return `${c} · ${k}`;
};

export default function SponsorInventoryPanel() {
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [forecast, setForecast] = useState<ForecastRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [inv, fc] = await Promise.all([
          supabase.rpc('get_sponsor_inventory_status' as any),
          supabase.rpc('get_sponsor_inventory_forecast' as any, { _days: 30 }),
        ]);
        if (!mounted) return;
        if (inv.error) throw inv.error;
        if (fc.error) throw fc.error;
        setInventory((inv.data || []) as InventoryRow[]);
        setForecast((fc.data || []) as ForecastRow[]);
        setError(null);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Falha ao carregar inventário');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const [filterCity, setFilterCity] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSlot, setFilterSlot] = useState('');

  const citySlug = filterCity.trim() ? normalizeSlug(filterCity) : '';
  const categorySlug = filterCategory.trim() ? normalizeSlug(filterCategory) : '';
  const slotQ = filterSlot.trim().toLowerCase();

  const matches = (row: { slot_slug: string; city: string; category: string }) =>
    (!slotQ || row.slot_slug === slotQ) &&
    (!citySlug || row.city === citySlug) &&
    (!categorySlug || row.category === categorySlug);

  const filteredInventory = useMemo(() => inventory.filter(matches), [inventory, slotQ, citySlug, categorySlug]);
  const filteredForecast = useMemo(() => forecast.filter(matches), [forecast, slotQ, citySlug, categorySlug]);

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (error) return <Card><CardContent className="p-6 text-destructive">{error}</CardContent></Card>;

  const saturated = filteredInventory.filter(r => r.status === 'saturated').length;
  const moderate = filteredInventory.filter(r => r.status === 'moderate').length;
  const available = filteredInventory.filter(r => r.status === 'available').length;
  const willSaturate = filteredForecast.filter(r => r.forecast === 'will_saturate').length;
  const hasFilter = !!(citySlug || categorySlug || slotQ);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input
            placeholder="Cidade (ex: Curitiba)"
            value={filterCity}
            onChange={e => setFilterCity(e.target.value)}
            aria-label="Filtrar por cidade"
          />
          <Input
            placeholder="Categoria (ex: eletricista)"
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            aria-label="Filtrar por categoria"
          />
          <Input
            placeholder="Slot (ex: banner, card)"
            value={filterSlot}
            onChange={e => setFilterSlot(e.target.value)}
            aria-label="Filtrar por slot"
          />
          <Button
            variant="outline"
            disabled={!hasFilter}
            onClick={() => { setFilterCity(''); setFilterCategory(''); setFilterSlot(''); }}
          >
            <X className="h-4 w-4 mr-1" />Limpar
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" />Disponíveis</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{available}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Moderados</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{moderate}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" />Saturados</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{saturated}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" />Saturação prevista (30d)</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{willSaturate}</CardContent>
        </Card>
      </div>


      <Tabs defaultValue="current">
        <TabsList>
          <TabsTrigger value="current">Ocupação atual</TabsTrigger>
          <TabsTrigger value="forecast">Forecast 30 dias</TabsTrigger>
        </TabsList>

        <TabsContent value="current">
          <Card>
            <CardHeader><CardTitle className="text-base">Ocupação por slot</CardTitle></CardHeader>
            <CardContent>
              {inventory.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem patrocinadores ativos no momento.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Slot</TableHead>
                      <TableHead>Escopo</TableHead>
                      <TableHead className="text-right">Ativos</TableHead>
                      <TableHead className="text-right">Capacidade</TableHead>
                      <TableHead className="text-right">Disponíveis</TableHead>
                      <TableHead className="text-right">Ocupação</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventory.map((r, i) => (
                      <TableRow key={`${r.slot_slug}-${r.city}-${r.category}-${i}`}>
                        <TableCell className="font-mono text-xs">{r.slot_slug}</TableCell>
                        <TableCell className="text-sm">{formatScope(r.city, r.category)}</TableCell>
                        <TableCell className="text-right">{r.active_sponsors}</TableCell>
                        <TableCell className="text-right">{r.max_capacity}</TableCell>
                        <TableCell className="text-right">{r.available_slots}</TableCell>
                        <TableCell className="text-right">{r.occupancy_rate}%</TableCell>
                        <TableCell><Badge variant={statusVariant[r.status]}>{r.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forecast">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Forecast 30 dias</CardTitle>
              <p className="text-xs text-muted-foreground">
                Projeção = ativos − encerrando + (média diária × 30). Não substitui análise comercial.
              </p>
            </CardHeader>
            <CardContent>
              {forecast.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados suficientes para projeção.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Slot</TableHead>
                      <TableHead>Escopo</TableHead>
                      <TableHead className="text-right">Ativos</TableHead>
                      <TableHead className="text-right">Encerrando</TableHead>
                      <TableHead className="text-right">Novos/dia</TableHead>
                      <TableHead className="text-right">Projetado</TableHead>
                      <TableHead className="text-right">Capacidade</TableHead>
                      <TableHead className="text-right">Ocupação prev.</TableHead>
                      <TableHead>Forecast</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {forecast.map((r, i) => (
                      <TableRow key={`${r.slot_slug}-${r.city}-${r.category}-${i}`}>
                        <TableCell className="font-mono text-xs">{r.slot_slug}</TableCell>
                        <TableCell className="text-sm">{formatScope(r.city, r.category)}</TableCell>
                        <TableCell className="text-right">{r.active_sponsors}</TableCell>
                        <TableCell className="text-right">{r.ending_soon}</TableCell>
                        <TableCell className="text-right">{r.avg_new_per_day}</TableCell>
                        <TableCell className="text-right">{r.projected_active}</TableCell>
                        <TableCell className="text-right">{r.max_capacity}</TableCell>
                        <TableCell className="text-right">{r.projected_occupancy_rate}%</TableCell>
                        <TableCell><Badge variant={forecastVariant[r.forecast]}>{r.forecast}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
