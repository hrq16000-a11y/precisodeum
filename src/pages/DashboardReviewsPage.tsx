import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import StarRating from '@/components/StarRating';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const DashboardReviewsPage = () => {
  const { user, provider, loading } = useAuth();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!provider) return;
    supabase.from('reviews')
      .select('*, profiles:user_id(full_name)')
      .eq('provider_id', provider.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setReviews(data); });
  }, [provider]);

  if (loading) return <DashboardLayout><p className="text-muted-foreground">Carregando...</p></DashboardLayout>;

  return (
    <DashboardLayout>
      <h1 className="font-display text-2xl font-bold text-foreground">Avaliações</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {reviews.length} avaliação(ões) recebida(s)
        {provider && ` • Média: ${provider.rating_avg}`}
      </p>

      <div className="mt-6 space-y-4">
        {reviews.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-12 text-center shadow-card">
            <p className="text-foreground font-semibold">Nenhuma avaliação ainda</p>
            <p className="mt-1 text-sm text-muted-foreground">As avaliações dos seus clientes aparecerão aqui.</p>
          </div>
        )}
        {reviews.map(r => (
          <div key={r.id} className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">
                {(r.profiles as any)?.full_name || 'Cliente'}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleDateString('pt-BR')}
              </span>
            </div>
            <div className="mt-2">
              <StarRating rating={r.rating} showValue={false} size={14} />
            </div>
            <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
              <span>Qualidade: {r.quality_rating}/5</span>
              <span>Pontualidade: {r.punctuality_rating}/5</span>
              <span>Atendimento: {r.service_rating}/5</span>
            </div>
            {r.comment && <p className="mt-3 text-sm text-foreground">{r.comment}</p>}
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default DashboardReviewsPage;
