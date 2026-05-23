import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import AdminChangeRequestDiff from '@/components/sponsors/AdminChangeRequestDiff';
import type { ChangeRequestRow, ChangeRequestStatus } from '@/lib/sponsorSelfService';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUSES: ChangeRequestStatus[] = ['pending', 'approved', 'rejected', 'cancelled'];

const AdminSponsorChangeRequestsPage = () => {
  const [statusFilter, setStatusFilter] = useState<ChangeRequestStatus>('pending');
  const [comments, setComments] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['admin-sponsor-change-requests', statusFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sponsor_change_requests' as any)
        .select('*, sponsors(id, title, company_name)')
        .eq('status', statusFilter)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const review = useCallback(
    async (id: string, decision: 'approved' | 'rejected') => {
      setBusyId(id);
      try {
        const { error } = await supabase.rpc('admin_review_sponsor_change_request' as any, {
          _id: id,
          _decision: decision,
          _comment: comments[id] || null,
        });
        if (error) throw error;
        toast.success(decision === 'approved' ? 'Solicitação aprovada.' : 'Solicitação rejeitada.');
        setComments((c) => ({ ...c, [id]: '' }));
        q.refetch();
      } catch (e: any) {
        toast.error(e?.message || 'Erro ao revisar.');
      } finally {
        setBusyId(null);
      }
    },
    [comments, q],
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Solicitações de patrocinadores</h1>
          <p className="text-sm text-muted-foreground">
            Revise alterações enviadas via self-service. Snapshot imutável evita race conditions.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? 'default' : 'outline'}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'pending' ? 'Pendentes' : s === 'approved' ? 'Aprovadas' : s === 'rejected' ? 'Rejeitadas' : 'Canceladas'}
            </Button>
          ))}
        </div>

        {q.isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
          </div>
        ) : (q.data || []).length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma solicitação neste status.
            </CardContent>
          </Card>
        ) : (
          (q.data || []).map((row: any) => {
            const r = row as ChangeRequestRow & { sponsors?: { title?: string; company_name?: string } };
            return (
              <Card key={r.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      {r.sponsors?.company_name || r.sponsors?.title || 'Patrocinador'}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {format(parseISO(r.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <AdminChangeRequestDiff row={r} />

                  {r.status === 'pending' && (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Comentário (opcional, visível para o patrocinador)"
                        value={comments[r.id] || ''}
                        onChange={(e) => setComments((c) => ({ ...c, [r.id]: e.target.value }))}
                        rows={2}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => review(r.id, 'approved')} disabled={busyId === r.id}>
                          <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" /> Aprovar
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => review(r.id, 'rejected')}
                          disabled={busyId === r.id}
                        >
                          <XCircle className="mr-2 h-4 w-4" aria-hidden="true" /> Rejeitar
                        </Button>
                      </div>
                    </div>
                  )}

                  {r.admin_comment && r.status !== 'pending' && (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Comentário: </span>
                      {r.admin_comment}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminSponsorChangeRequestsPage;
