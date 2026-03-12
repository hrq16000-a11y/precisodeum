import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Check, X, Eye } from 'lucide-react';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

const statusLabels: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pendente', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  approved: { label: 'Aprovado', cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  rejected: { label: 'Rejeitado', cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
};

const AdminProvidersPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [providers, setProviders] = useState<any[]>([]);
  const [filter, setFilter] = useState('pending');

  const fetchProviders = async () => {
    let query = supabase
      .from('providers')
      .select('*, categories(name), profiles:user_id(full_name, email)')
      .order('created_at', { ascending: false });
    if (filter !== 'all') query = query.eq('status', filter);
    const { data } = await query;
    setProviders(data || []);
  };

  useEffect(() => { if (isAdmin) fetchProviders(); }, [isAdmin, filter]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('providers').update({ status }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success(status === 'approved' ? 'Prestador aprovado!' : 'Prestador rejeitado');
    fetchProviders();
  };

  if (loading) return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl font-bold text-foreground">Gerenciar Prestadores</h1>
      <p className="mt-1 text-sm text-muted-foreground">{providers.length} prestador(es)</p>

      <div className="mt-4 flex gap-2">
        {['pending', 'approved', 'rejected', 'all'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${filter === f ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            {f === 'all' ? 'Todos' : statusLabels[f]?.label || f}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {providers.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-12 text-center shadow-card">
            <p className="text-foreground font-semibold">Nenhum prestador encontrado</p>
          </div>
        )}
        {providers.map(p => (
          <div key={p.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-bold text-foreground">
                    {(p.profiles as any)?.full_name || p.business_name || 'Sem nome'}
                  </h3>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusLabels[p.status]?.cls || 'bg-muted text-muted-foreground'}`}>
                    {statusLabels[p.status]?.label || p.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {(p.categories as any)?.name || 'Sem categoria'} • {p.city}, {p.state}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(p.profiles as any)?.email} • {p.phone}
                </p>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{p.description}</p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {p.slug && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={`/profissional/${p.slug}`}><Eye className="h-4 w-4" /></Link>
                  </Button>
                )}
                {p.status !== 'approved' && (
                  <Button variant="outline" size="sm" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => updateStatus(p.id, 'approved')}>
                    <Check className="h-4 w-4" /> Aprovar
                  </Button>
                )}
                {p.status !== 'rejected' && (
                  <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => updateStatus(p.id, 'rejected')}>
                    <X className="h-4 w-4" /> Rejeitar
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
};

export default AdminProvidersPage;
