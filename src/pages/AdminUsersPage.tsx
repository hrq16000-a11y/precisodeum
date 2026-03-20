import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Edit2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

const AdminUsersPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', email: '', phone: '', role: '', profile_type: '' });

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

  const startEdit = (p: any) => {
    setEditId(p.id);
    setEditForm({ full_name: p.full_name || '', email: p.email || '', phone: p.phone || '', role: p.role || 'client', profile_type: (p as any).profile_type || p.role || 'client' });
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

  if (loading) return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl font-bold text-foreground">Gerenciar Usuários</h1>
      <p className="mt-1 text-sm text-muted-foreground">{profiles.length} usuário(s)</p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nome</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">E-mail</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Telefone</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tipo de Conta</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Cadastro</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map(p => (
              <tr key={p.id} className="border-b border-border bg-card hover:bg-muted/30 transition-colors">
                {editId === p.id ? (
                  <>
                    <td className="px-4 py-3">
                      <input value={editForm.full_name} onChange={e => setEditForm(prev => ({ ...prev, full_name: e.target.value }))}
                        className="w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground" />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{p.email || '—'}</td>
                    <td className="px-4 py-3">
                      <input value={editForm.phone} onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground" />
                    </td>
                    <td className="px-4 py-3">
                      <select value={editForm.profile_type} onChange={e => setEditForm(prev => ({ ...prev, profile_type: e.target.value }))}
                        className="rounded border border-input bg-background px-2 py-1 text-sm text-foreground">
                        {PROFILE_TYPE_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="accent" onClick={handleSave}>Salvar</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditId(null)}><X className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-medium text-foreground">{p.full_name || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.email || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${profileTypeBadge((p as any).profile_type || p.role)}`}>
                        {profileTypeLabel((p as any).profile_type || p.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(p)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
};

export default AdminUsersPage;
