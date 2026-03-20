import { useState, useEffect, useMemo } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Edit2, X, Search, Users, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PaginationControls from '@/components/PaginationControls';

const PROFILE_TYPE_OPTIONS = [
  { value: 'client', label: 'Cliente' },
  { value: 'provider', label: 'Profissional' },
  { value: 'rh', label: 'Agência / RH' },
];

const profileTypeLabel = (t: string) => PROFILE_TYPE_OPTIONS.find(o => o.value === t)?.label || t;
const profileTypeBadge = (t: string) => {
  if (t === 'rh') return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
  if (t === 'provider') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
  return 'bg-muted text-muted-foreground';
};

const PAGE_SIZE = 20;

const AdminUsersPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [page, setPage] = useState(1);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', email: '', phone: '', profile_type: '' });

  const fetchProfiles = () => {
    supabase.from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setProfiles(data || []));
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchProfiles();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    let list = profiles;
    if (filterType !== 'all') {
      list = list.filter(p => (p.profile_type || p.role) === filterType);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        (p.full_name || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q) ||
        (p.phone || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [profiles, search, filterType]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const startEdit = (p: any) => {
    setEditId(p.id);
    setEditForm({
      full_name: p.full_name || '',
      email: p.email || '',
      phone: p.phone || '',
      profile_type: p.profile_type || p.role || 'client',
    });
  };

  const handleSave = async () => {
    if (!editId) return;
    const { error } = await supabase.from('profiles').update({
      full_name: editForm.full_name,
      phone: editForm.phone,
      role: editForm.profile_type === 'rh' ? 'client' : editForm.profile_type,
      profile_type: editForm.profile_type,
    } as any).eq('id', editId);

    if (error) {
      toast.error('Erro ao atualizar: ' + error.message);
    } else {
      toast.success('Usuário atualizado!');
      setEditId(null);
      fetchProfiles();
    }
  };

  const makeAdmin = async (userId: string) => {
    const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: 'admin' } as any);
    if (error) {
      if (error.code === '23505') toast.info('Usuário já é admin');
      else toast.error('Erro: ' + error.message);
    } else {
      toast.success('Usuário promovido a admin!');
    }
  };

  if (loading) return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;

  const stats = {
    total: profiles.length,
    clients: profiles.filter(p => (p.profile_type || p.role) === 'client').length,
    providers: profiles.filter(p => (p.profile_type || p.role) === 'provider').length,
    rh: profiles.filter(p => (p.profile_type || p.role) === 'rh').length,
  };

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
        <Users className="h-6 w-6" /> Gerenciar Usuários
      </h1>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total', value: stats.total, color: 'text-foreground' },
          { label: 'Clientes', value: stats.clients, color: 'text-muted-foreground' },
          { label: 'Profissionais', value: stats.providers, color: 'text-blue-500' },
          { label: 'Agências RH', value: stats.rh, color: 'text-purple-500' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-3 shadow-card">
            <p className={`font-display text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail ou telefone..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={v => { setFilterType(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {PROFILE_TYPE_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">{filtered.length} resultado(s)</p>

      {/* Table */}
      <div className="mt-3 overflow-x-auto rounded-xl border border-border shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nome</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">E-mail</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Telefone</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tipo</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Cadastro</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map(p => (
              <tr key={p.id} className="border-b border-border bg-card hover:bg-muted/30 transition-colors">
                {editId === p.id ? (
                  <>
                    <td className="px-4 py-3">
                      <Input value={editForm.full_name} onChange={e => setEditForm(prev => ({ ...prev, full_name: e.target.value }))} className="h-8 text-sm" />
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground text-xs">{p.email || '—'}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Input value={editForm.phone} onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))} className="h-8 text-sm" />
                    </td>
                    <td className="px-4 py-3">
                      <Select value={editForm.profile_type} onValueChange={v => setEditForm(prev => ({ ...prev, profile_type: v }))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PROFILE_TYPE_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">{new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="accent" onClick={handleSave}>Salvar</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditId(null)}><X className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{p.full_name || '—'}</p>
                      <p className="text-[10px] text-muted-foreground sm:hidden">{p.email || ''}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground text-xs">{p.email || '—'}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">{p.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${profileTypeBadge(p.profile_type || p.role)}`}>
                        {profileTypeLabel(p.profile_type || p.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">{new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => startEdit(p)} title="Editar">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => makeAdmin(p.id)} title="Promover a Admin">
                          <Shield className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4">
          <PaginationControls currentPage={page} totalItems={filtered.length} itemsPerPage={PAGE_SIZE} onPageChange={setPage} />
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminUsersPage;
