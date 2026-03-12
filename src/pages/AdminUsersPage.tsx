import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';

const AdminUsersPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [profiles, setProfiles] = useState<any[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    supabase.from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setProfiles(data || []));
  }, [isAdmin]);

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
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tipo</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Cadastro</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map(p => (
              <tr key={p.id} className="border-b border-border bg-card hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{p.full_name || '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.email || '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.phone || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.role === 'provider' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-muted text-muted-foreground'}`}>
                    {p.role === 'provider' ? 'Profissional' : 'Cliente'}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
};

export default AdminUsersPage;
