import { useState, useEffect, useMemo } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Trash2, CheckCircle, XCircle, Search, MessageSquare, Download } from 'lucide-react';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import StarRating from '@/components/StarRating';
import PaginationControls from '@/components/PaginationControls';
import { logAuditAction } from '@/hooks/useAuditLog';

const PAGE_SIZE = 20;

const AdminReviewsPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [reviews, setReviews] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [moderateReview, setModerateReview] = useState<any | null>(null);
  const [adminNote, setAdminNote] = useState('');

  const fetchReviews = async () => {
    const { data } = await supabase
      .from('reviews')
      .select('*, profiles:user_id(full_name, email), providers:provider_id(business_name, city)')
      .order('created_at', { ascending: false });
    setReviews(data || []);
  };

  useEffect(() => { if (isAdmin) fetchReviews(); }, [isAdmin]);

  const filtered = useMemo(() => {
    let list = reviews;
    if (filterStatus !== 'all') list = list.filter(r => (r.approval_status || 'pending') === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        ((r.profiles as any)?.full_name || '').toLowerCase().includes(q) ||
        ((r.providers as any)?.business_name || '').toLowerCase().includes(q) ||
        (r.comment || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [reviews, search, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = {
    total: reviews.length,
    pending: reviews.filter(r => (r.approval_status || 'pending') === 'pending').length,
    approved: reviews.filter(r => r.approval_status === 'approved').length,
    rejected: reviews.filter(r => r.approval_status === 'rejected').length,
  };

  const handleApprove = async (review: any) => {
    const { error } = await supabase.from('reviews').update({ approval_status: 'approved', admin_note: '' } as any).eq('id', review.id);
    if (error) toast.error(error.message);
    else {
      await logAuditAction({ action: 'approve', resource_type: 'review', resource_id: review.id });
      toast.success('Avaliação aprovada!');
      fetchReviews();
    }
  };

  const handleReject = async () => {
    if (!moderateReview) return;
    const { error } = await supabase.from('reviews').update({ approval_status: 'rejected', admin_note: adminNote } as any).eq('id', moderateReview.id);
    if (error) toast.error(error.message);
    else {
      await logAuditAction({ action: 'reject', resource_type: 'review', resource_id: moderateReview.id, details: { reason: adminNote } });
      toast.success('Avaliação rejeitada');
      setModerateReview(null);
      setAdminNote('');
      fetchReviews();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta avaliação permanentemente?')) return;
    const { error } = await supabase.from('reviews').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      await logAuditAction({ action: 'delete', resource_type: 'review', resource_id: id });
      toast.success('Avaliação removida');
      fetchReviews();
    }
  };

  const handleExport = () => {
    const csvHeader = 'Autor,Email,Prestador,Nota,Qualidade,Pontualidade,Atendimento,Comentário,Status,Data\n';
    const csvRows = filtered.map(r =>
      `"${(r.profiles as any)?.full_name || ''}","${(r.profiles as any)?.email || ''}","${(r.providers as any)?.business_name || ''}","${r.rating}","${r.quality_rating}","${r.punctuality_rating}","${r.service_rating}","${(r.comment || '').replace(/"/g, '""')}","${r.approval_status || 'pending'}","${r.created_at}"`
    ).join('\n');
    const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `avaliacoes_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado!');
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge className="bg-green-100 text-green-700 text-[10px]">Aprovada</Badge>;
      case 'rejected': return <Badge variant="destructive" className="text-[10px]">Rejeitada</Badge>;
      default: return <Badge variant="secondary" className="text-[10px]">Pendente</Badge>;
    }
  };

  if (loading) return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
        <MessageSquare className="h-6 w-6" /> Moderar Avaliações
      </h1>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-foreground' },
          { label: 'Pendentes', value: stats.pending, color: 'text-yellow-600' },
          { label: 'Aprovadas', value: stats.approved, color: 'text-green-600' },
          { label: 'Rejeitadas', value: stats.rejected, color: 'text-destructive' },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-3 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por autor, prestador ou comentário..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="approved">Aprovadas</SelectItem>
            <SelectItem value="rejected">Rejeitadas</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" /> Exportar
        </Button>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">{filtered.length} avaliação(ões)</p>

      {/* Reviews */}
      <div className="mt-4 space-y-3">
        {paginated.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-12 text-center shadow-card">
            <p className="text-foreground font-semibold">Nenhuma avaliação encontrada</p>
          </div>
        )}
        {paginated.map(r => (
          <div key={r.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-foreground">{(r.profiles as any)?.full_name || 'Anônimo'}</span>
                  <span className="text-xs text-muted-foreground">→</span>
                  <span className="text-sm text-muted-foreground">{(r.providers as any)?.business_name || 'Prestador'}</span>
                  {statusBadge(r.approval_status || 'pending')}
                </div>
                <div className="mt-1">
                  <StarRating rating={r.rating} showValue size={14} />
                </div>
                <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                  <span>Qualidade: {r.quality_rating}/5</span>
                  <span>Pontualidade: {r.punctuality_rating}/5</span>
                  <span>Atendimento: {r.service_rating}/5</span>
                </div>
                {r.comment && <p className="mt-2 text-sm text-foreground">{r.comment}</p>}
                {r.admin_note && (
                  <p className="mt-1 text-xs text-destructive italic">Nota admin: {r.admin_note}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString('pt-BR')} • {(r.profiles as any)?.email}
                </p>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                {(r.approval_status || 'pending') !== 'approved' && (
                  <Button variant="ghost" size="sm" className="text-green-600" onClick={() => handleApprove(r)} title="Aprovar">
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                )}
                {(r.approval_status || 'pending') !== 'rejected' && (
                  <Button variant="ghost" size="sm" className="text-yellow-600" onClick={() => { setModerateReview(r); setAdminNote(''); }} title="Rejeitar">
                    <XCircle className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(r.id)} title="Excluir">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-4">
          <PaginationControls currentPage={page} totalItems={filtered.length} itemsPerPage={PAGE_SIZE} onPageChange={setPage} />
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={!!moderateReview} onOpenChange={open => !open && setModerateReview(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Rejeitar Avaliação</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Rejeitar avaliação de <strong>{(moderateReview?.profiles as any)?.full_name}</strong>
          </p>
          <div>
            <Label>Motivo (opcional)</Label>
            <Textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} placeholder="Motivo da rejeição..." rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModerateReview(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReject}>
              <XCircle className="h-4 w-4 mr-1" /> Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminReviewsPage;
