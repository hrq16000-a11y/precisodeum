import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatCityState, normalizeUF, safeUF } from '@/lib/locationFormat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { AlertTriangle, CheckCircle2, RefreshCw, Loader2 } from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';

type Row = {
  source: 'profiles' | 'providers' | 'agencies';
  id: string;
  user_ref?: string | null;
  display_name?: string | null;
  city_raw: string | null;
  state_raw: string | null;
};

const inspect = (row: Row) => {
  const uf = safeUF(row.state_raw);
  const formatted = formatCityState(row.city_raw || '', row.state_raw || '');
  const normalized = normalizeUF(row.state_raw);
  const cityOk = !!(row.city_raw && row.city_raw.trim());
  const stateOk = !!uf;
  const divergent =
    (!!row.state_raw && !uf) || // unknown state string
    (cityOk && !stateOk) || // city without UF
    (row.state_raw && row.state_raw.trim().length > 2 && !!normalized); // full name stored
  return { uf, formatted, normalized, cityOk, stateOk, divergent: !!divergent };
};

export default function AdminLocationDebugPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'divergent'>('divergent');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [profilesRes, providersRes, agenciesRes] = await Promise.all([
        supabase.from('profiles').select('id, user_ref, full_name, city, state').limit(500),
        supabase.from('providers').select('id, user_ref, display_name, city, state').limit(500),
        supabase.from('agencies').select('id, name, city, state').limit(200),
      ]);
      const all: Row[] = [];
      (profilesRes.data || []).forEach((r: any) =>
        all.push({ source: 'profiles', id: r.id, user_ref: r.user_ref, display_name: r.full_name, city_raw: r.city, state_raw: r.state }),
      );
      (providersRes.data || []).forEach((r: any) =>
        all.push({ source: 'providers', id: r.id, user_ref: r.user_ref, display_name: r.display_name, city_raw: r.city, state_raw: r.state }),
      );
      (agenciesRes.data || []).forEach((r: any) =>
        all.push({ source: 'agencies', id: r.id, display_name: r.name, city_raw: r.city, state_raw: r.state }),
      );
      setRows(all);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const meta = inspect(r);
      if (filter === 'divergent' && !meta.divergent) return false;
      if (q && !`${r.display_name || ''} ${r.city_raw || ''} ${r.state_raw || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, filter, search]);

  const stats = useMemo(() => {
    const total = rows.length;
    const divergent = rows.filter((r) => inspect(r).divergent).length;
    return { total, divergent, healthy: total - divergent };
  }, [rows]);

  return (
    <div className="container mx-auto max-w-6xl space-y-4 p-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Debug de localização (city/state)</h1>
          <p className="text-sm text-muted-foreground">
            Inspeciona valores raw vs formatados em profiles/providers/agencies para detectar divergências.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Recarregar
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-3 text-sm"><div className="text-muted-foreground">Total inspecionado</div><div className="text-2xl font-bold">{stats.total}</div></Card>
        <Card className="p-3 text-sm"><div className="text-muted-foreground">Divergências</div><div className="text-2xl font-bold text-destructive">{stats.divergent}</div></Card>
        <Card className="p-3 text-sm"><div className="text-muted-foreground">OK</div><div className="text-2xl font-bold text-emerald-600">{stats.healthy}</div></Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Buscar por nome, cidade ou estado…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <Button variant={filter === 'divergent' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('divergent')}>
          Só divergentes
        </Button>
        <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>
          Tudo
        </Button>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-2 py-2">Fonte</th>
              <th className="px-2 py-2">Nome</th>
              <th className="px-2 py-2">city (raw)</th>
              <th className="px-2 py-2">state (raw)</th>
              <th className="px-2 py-2">UF normalizado</th>
              <th className="px-2 py-2">Exibido</th>
              <th className="px-2 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 300).map((r) => {
              const meta = inspect(r);
              return (
                <tr key={`${r.source}-${r.id}`} className="border-t border-border">
                  <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground">{r.source}</td>
                  <td className="px-2 py-1.5">{r.display_name || '—'}</td>
                  <td className="px-2 py-1.5">{r.city_raw || <span className="text-muted-foreground">∅</span>}</td>
                  <td className="px-2 py-1.5">{r.state_raw || <span className="text-muted-foreground">∅</span>}</td>
                  <td className="px-2 py-1.5 font-mono">{meta.uf || '—'}</td>
                  <td className="px-2 py-1.5">{meta.formatted || '—'}</td>
                  <td className="px-2 py-1.5">
                    {meta.divergent ? (
                      <span className="inline-flex items-center gap-1 text-destructive">
                        <AlertTriangle className="h-3 w-3" /> divergente
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" /> ok
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-2 py-6 text-center text-muted-foreground">Nenhum registro com os filtros atuais.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
