import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Eye, MousePointerClick, MessageSquare, Star, TrendingUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const DashboardPage = () => {
  const { user, provider, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [loading, user, navigate]);

  if (loading) return <DashboardLayout><p className="text-muted-foreground">Carregando...</p></DashboardLayout>;

  const stats = [
    { label: 'Visualizações', value: '—', icon: Eye, change: '' },
    { label: 'Cliques em contato', value: '—', icon: MousePointerClick, change: '' },
    { label: 'Leads recebidos', value: '—', icon: MessageSquare, change: '' },
    { label: 'Avaliação média', value: provider?.rating_avg?.toString() || '—', icon: Star, change: '' },
    { label: 'Ranking na busca', value: '—', icon: TrendingUp, change: '' },
  ];

  return (
    <DashboardLayout>
      <h1 className="font-display text-2xl font-bold text-foreground">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">Bem-vindo de volta!</p>

      {!provider && (
        <div className="mt-6 rounded-xl border border-accent/30 bg-accent/5 p-6">
          <h2 className="font-display text-lg font-bold text-foreground">Complete seu perfil profissional</h2>
          <p className="mt-1 text-sm text-muted-foreground">Para aparecer nos resultados de busca, complete seu perfil.</p>
          <button onClick={() => navigate('/dashboard/perfil')} className="mt-3 text-sm font-medium text-accent hover:underline">
            Completar perfil →
          </button>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center justify-between">
              <s.icon className="h-5 w-5 text-muted-foreground" />
              {s.change && <span className="text-xs font-medium text-success">{s.change}</span>}
            </div>
            <p className="mt-3 font-display text-2xl font-bold text-foreground">{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;
