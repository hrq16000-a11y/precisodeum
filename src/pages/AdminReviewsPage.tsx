import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import StarRating from '@/components/StarRating';

const AdminReviewsPage = () => {
  const { isAdmin, loading } = useAdmin();
  const [reviews, setReviews] = useState<any[]>([]);

  const fetchReviews = async () => {
    const { data } = await supabase
      .from('reviews')
      .select('*, profiles:user_id(full_name, email), providers:provider_id(business_name, city)')
      .order('created_at', { ascending: false });
    setReviews(data || []);
  };

  useEffect(() => { if (isAdmin) fetchReviews(); }, [isAdmin]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('reviews').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Avaliação removida');
    fetchReviews();
  };

  if (loading) return <AdminLayout><p className="text-muted-foreground">Carregando...</p></AdminLayout>;

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl font-bold text-foreground">Moderar Avaliações</h1>
      <p className="mt-1 text-sm text-muted-foreground">{reviews.length} avaliação(ões)</p>

      <div className="mt-6 space-y-3">
        {reviews.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-12 text-center shadow-card">
            <p className="text-foreground font-semibold">Nenhuma avaliação cadastrada</p>
          </div>
        )}
        {reviews.map(r => (
          <div key={r.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{(r.profiles as any)?.full_name || 'Anônimo'}</span>
                  <span className="text-xs text-muted-foreground">→</span>
                  <span className="text-sm text-muted-foreground">{(r.providers as any)?.business_name || 'Prestador'}</span>
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
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString('pt-BR')} • {(r.profiles as any)?.email}
                </p>
              </div>
              <Button variant="ghost" size="sm" className="text-destructive shrink-0" onClick={() => handleDelete(r.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
};

export default AdminReviewsPage;
