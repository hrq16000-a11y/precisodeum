import { useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Trash2, Pencil, ExternalLink, CheckCircle, XCircle } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const AdminJobsPage = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
  const queryClient = useQueryClient();
  const [editJob, setEditJob] = useState<any>(null);
  const [editForm, setEditForm] = useState({ status: 'active', title: '', description: '', approval_status: 'approved' });
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['admin-jobs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('jobs')
        .select('*, categories(name, icon)')
        .order('created_at', { ascending: false })
        .limit(200);
      return data || [];
    },
    enabled: isAdmin,
  });

  const filteredJobs = filter === 'all' ? jobs : jobs.filter((j: any) => j.approval_status === filter);
  const pendingCount = jobs.filter((j: any) => j.approval_status === 'pending').length;

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta vaga?')) return;
    await supabase.from('jobs').delete().eq('id', id);
    toast.success('Vaga excluída');
    queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
  };

  const handleApprove = async (id: string) => {
    await supabase.from('jobs').update({ approval_status: 'approved' } as any).eq('id', id);
    toast.success('Vaga aprovada!');
    queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
  };

  const handleReject = async (id: string) => {
    await supabase.from('jobs').update({ approval_status: 'rejected', status: 'inactive' } as any).eq('id', id);
    toast.success('Vaga rejeitada');
    queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
  };

  const handleEdit = (job: any) => {
    setEditJob(job);
    setEditForm({ status: job.status, title: job.title, description: job.description, approval_status: (job as any).approval_status || 'approved' });
  };

  const handleSave = async () => {
    if (!editJob) return;
    await supabase.from('jobs').update(editForm as any).eq('id', editJob.id);
    toast.success('Vaga atualizada');
    setEditJob(null);
    queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
  };

  if (adminLoading) return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl font-bold text-foreground">Gestão de Vagas</h1>
      <p className="mt-1 text-sm text-muted-foreground">Modere e gerencie vagas publicadas na plataforma</p>

      {/* Filters */}
      <div className="mt-4 flex gap-2 flex-wrap">
        {[
          { value: 'all', label: `Todas (${jobs.length})` },
          { value: 'pending', label: `Pendentes (${pendingCount})` },
          { value: 'approved', label: 'Aprovadas' },
          { value: 'rejected', label: 'Rejeitadas' },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value as any)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${filter === f.value ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="mt-8 text-muted-foreground">Carregando...</p>
      ) : (
        <div className="mt-6 space-y-2">
          {filteredJobs.map((job: any) => (
            <div key={job.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-medium text-foreground truncate text-sm">{job.title}</h3>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${job.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                    {job.status === 'active' ? 'Ativa' : 'Inativa'}
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    job.approval_status === 'pending' ? 'bg-amber-100 text-amber-700' :
                    job.approval_status === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {job.approval_status === 'pending' ? '⏳ Pendente' : job.approval_status === 'rejected' ? '❌ Rejeitada' : '✅ Aprovada'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {(job.categories as any)?.name || 'Sem categoria'} · {job.city || '?'} · {new Date(job.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {job.approval_status === 'pending' && (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => handleApprove(job.id)} title="Aprovar">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleReject(job.id)} title="Rejeitar">
                      <XCircle className="h-4 w-4 text-red-600" />
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="icon" onClick={() => window.open(`/vaga/${job.slug || job.id}`, '_blank')}><ExternalLink className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleEdit(job)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(job.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
          {filteredJobs.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhuma vaga encontrada.</p>}
        </div>
      )}

      <Dialog open={!!editJob} onOpenChange={() => setEditJob(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Editar Vaga</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Título</label>
              <input value={editForm.title} onChange={(e) => setEditForm(p => ({ ...p, title: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Descrição</label>
              <textarea value={editForm.description} onChange={(e) => setEditForm(p => ({ ...p, description: e.target.value }))} rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Status</label>
                <select value={editForm.status} onChange={(e) => setEditForm(p => ({ ...p, status: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground">
                  <option value="active">Ativa</option>
                  <option value="inactive">Inativa</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Aprovação</label>
                <select value={editForm.approval_status} onChange={(e) => setEditForm(p => ({ ...p, approval_status: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground">
                  <option value="approved">Aprovada</option>
                  <option value="pending">Pendente</option>
                  <option value="rejected">Rejeitada</option>
                </select>
              </div>
            </div>
            <Button variant="accent" className="w-full" onClick={handleSave}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminJobsPage;
