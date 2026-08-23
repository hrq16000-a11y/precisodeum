/**
 * AdminDefaultNeighborhoodPage
 *
 * Lista todos os providers cujo bairro foi preenchido automaticamente
 * como "Centro" pelo trigger `fill_provider_neighborhood_default`.
 *
 * Modo de correção em lote:
 *  - Selecionar múltiplos providers
 *  - Aplicar novo bairro com justificativa obrigatória (≥5 chars)
 *  - RPC admin_bulk_fix_provider_neighborhood registra auditoria
 *    em provider_neighborhood_corrections (admin, antes/depois, motivo, data).
 */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Link } from '@/lib/router-compat';
import { MapPin, RefreshCw, AlertTriangle, ExternalLink, Wand2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Row {
  id: string;
  user_id: string;
  full_name: string | null;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  neighborhood_source: string | null;
  neighborhood_source_at: string | null;
  has_coords: boolean;
  status: string | null;
  updated_at: string | null;
}

export default function AdminDefaultNeighborhoodPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkNeighborhood, setBulkNeighborhood] = useState('');
  const [bulkReason, setBulkReason] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setSelected(new Set());
    try {
      const { data, error } = await supabase.rpc('admin_list_default_neighborhood_providers', {
        _city: city || null,
        _state: state || null,
        _limit: 500,
      });
      if (error) throw error;
      setRows((data as any) || []);
    } catch (e: any) {
      toast.error('Falha ao carregar: ' + (e?.message || ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmtDate = (iso: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      });
    } catch { return '—'; }
  };

  const allChecked = rows.length > 0 && selected.size === rows.length;
  const indeterminate = selected.size > 0 && !allChecked;

  const toggleAll = () => {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const canBulkSave = useMemo(
    () => selected.size > 0 && bulkNeighborhood.trim().length >= 2 && bulkReason.trim().length >= 5,
    [selected, bulkNeighborhood, bulkReason],
  );

  const handleBulkSave = async () => {
    if (!canBulkSave) return;
    setBulkSaving(true);
    try {
      const { data, error } = await supabase.rpc('admin_bulk_fix_provider_neighborhood', {
        _provider_ids: Array.from(selected) as any,
        _new_neighborhood: bulkNeighborhood.trim(),
        _reason: bulkReason.trim(),
      });
      if (error) throw error;
      const res = (data || {}) as { updated?: number; errors?: number };
      toast.success(`${res.updated || 0} provider(s) atualizado(s)`, {
        description: res.errors ? `${res.errors} falharam — verifique permissões.` : 'Auditoria registrada.',
      });
      setBulkOpen(false);
      setBulkNeighborhood('');
      setBulkReason('');
      await load();
    } catch (e: any) {
      toast.error('Erro ao aplicar correção', { description: e?.message || 'Tente novamente.' });
    } finally {
      setBulkSaving(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-4">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-amber-600" />
          Providers com bairro padrão "Centro"
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cadastros onde o sistema preencheu o bairro automaticamente. Selecione vários e aplique
          correção em lote — toda alteração fica registrada com autor, antes/depois, motivo e data.
        </p>
      </header>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_120px_auto]">
          <Input
            placeholder="Filtrar por cidade…"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <Input
            placeholder="UF (ex: PR)"
            value={state}
            maxLength={2}
            onChange={(e) => setState(e.target.value.toUpperCase())}
          />
          <Button onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Aplicar
          </Button>
        </div>
      </Card>

      {/* Barra de ação em lote */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2">
        <div className="text-xs text-muted-foreground">
          <strong className="text-foreground">{selected.size}</strong> selecionado(s) de {rows.length}
        </div>
        <Button
          size="sm"
          disabled={selected.size === 0}
          onClick={() => setBulkOpen(true)}
          className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white hover:opacity-95"
        >
          <Wand2 className="mr-1.5 h-4 w-4" /> Corrigir em lote ({selected.size})
        </Button>
      </div>

      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase">
            <tr>
              <th className="p-3 w-10">
                <Checkbox
                  checked={allChecked || (indeterminate ? 'indeterminate' as any : false)}
                  onCheckedChange={toggleAll}
                  aria-label="Selecionar todos"
                />
              </th>
              <th className="p-3">Profissional</th>
              <th className="p-3">Cidade / UF</th>
              <th className="p-3">Bairro</th>
              <th className="p-3">GPS</th>
              <th className="p-3">Status</th>
              <th className="p-3">Auto-preenchido em</th>
              <th className="p-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">
                  Nenhum cadastro com bairro padrão automático encontrado.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t hover:bg-muted/30">
                <td className="p-3">
                  <Checkbox
                    checked={selected.has(r.id)}
                    onCheckedChange={() => toggleOne(r.id)}
                    aria-label={`Selecionar ${r.full_name || r.id}`}
                  />
                </td>
                <td className="p-3 font-medium">{r.full_name || '—'}</td>
                <td className="p-3">
                  {r.city || '—'} {r.state ? `/ ${r.state}` : ''}
                </td>
                <td className="p-3">
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30">
                    <MapPin className="mr-1 h-3 w-3" />
                    {r.neighborhood || 'Centro'} (auto)
                  </Badge>
                </td>
                <td className="p-3">
                  {r.has_coords ? (
                    <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">OK</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">sem GPS</Badge>
                  )}
                </td>
                <td className="p-3">
                  <Badge variant={r.status === 'approved' ? 'default' : 'secondary'}>
                    {r.status || '—'}
                  </Badge>
                </td>
                <td className="p-3 text-xs text-muted-foreground">{fmtDate(r.neighborhood_source_at)}</td>
                <td className="p-3 text-right">
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/admin/prestadores?id=${r.id}`}>
                      Ver
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {rows.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Total exibido: {rows.length}. Limite máximo: 500.
        </p>
      )}

      {/* Dialog de correção em lote */}
      <Dialog open={bulkOpen} onOpenChange={(o) => { if (!bulkSaving) setBulkOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Corrigir bairro de {selected.size} provider(s)</DialogTitle>
            <DialogDescription>
              O novo bairro será aplicado a todos os selecionados. Cada alteração fica registrada
              com autor (você), bairro anterior, novo bairro, motivo e data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="bulk-n">Novo bairro</Label>
              <Input
                id="bulk-n"
                value={bulkNeighborhood}
                onChange={(e) => setBulkNeighborhood(e.target.value)}
                placeholder="Ex: Centro Histórico, Boa Vista..."
                disabled={bulkSaving}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bulk-r">Justificativa (mín. 5 caracteres)</Label>
              <Textarea
                id="bulk-r"
                value={bulkReason}
                onChange={(e) => setBulkReason(e.target.value)}
                placeholder="Ex: Confirmado por contato telefônico — bairro real é Boa Vista."
                rows={3}
                disabled={bulkSaving}
              />
              <p className="text-[11px] text-muted-foreground">{bulkReason.trim().length}/5 mínimos</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={bulkSaving} onClick={() => setBulkOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleBulkSave} disabled={!canBulkSave || bulkSaving}>
              {bulkSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Wand2 className="mr-1.5 h-4 w-4" />}
              Aplicar a {selected.size} provider(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
