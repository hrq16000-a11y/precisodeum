/**
 * AdminDefaultNeighborhoodPage
 *
 * Lista todos os providers cujo bairro foi preenchido automaticamente
 * como "Centro" pelo trigger `fill_provider_neighborhood_default`.
 *
 * Permite ao admin revisar caso a caso e contatar o profissional para
 * preencher o bairro real, melhorando a precisão do badge "Atende no
 * seu bairro".
 *
 * Fonte: RPC admin_list_default_neighborhood_providers (SECURITY DEFINER
 * com guard has_role('admin')).
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { MapPin, RefreshCw, AlertTriangle, ExternalLink } from 'lucide-react';
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

  const load = async () => {
    setLoading(true);
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

  return (
    <div className="container mx-auto py-6 space-y-4">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-amber-600" />
          Providers com bairro padrão "Centro"
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cadastros onde o sistema preencheu o bairro automaticamente porque o profissional
          não informou. Revise e contate quando necessário para melhorar a precisão geográfica.
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

      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase">
            <tr>
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
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  Nenhum cadastro com bairro padrão automático encontrado.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t hover:bg-muted/30">
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
    </div>
  );
}
