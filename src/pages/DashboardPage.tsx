import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Eye, MousePointerClick, MessageSquare, Star, TrendingUp, Briefcase, User, ArrowRight, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSettingValue } from '@/hooks/useSiteSettings';
import { supabase } from '@/integrations/supabase/client';

const DashboardPage = () => {
  const { user, provider, loading } = useAuth();
  const navigate = useNavigate();
  const whatsappGroupUrl = useSettingValue('whatsapp_group_url');
  const [servicesCount, setServicesCount] = useState<number | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!provider) return;
    supabase
      .from('services')
      .select('id', { count: 'exact', head: true })
      .eq('provider_id', provider.id)
      .then(({ count }) => setServicesCount(count ?? 0));
  }, [provider]);

  if (loading) return <DashboardLayout><p className="text-muted-foreground">Carregando...</p></DashboardLayout>;

  const stats = [
    { label: 'Visualizações', value: '—', icon: Eye, change: '' },
    { label: 'Cliques em contato', value: '—', icon: MousePointerClick, change: '' },
    { label: 'Leads recebidos', value: '—', icon: MessageSquare, change: '' },
    { label: 'Avaliação média', value: provider?.rating_avg?.toString() || '—', icon: Star, change: '' },
    { label: 'Ranking na busca', value: '—', icon: TrendingUp, change: '' },
  ];

  const steps = [
    {
      number: '1',
      title: 'Complete seu perfil',
      description: 'Adicione sua foto, descrição profissional, cidade e contato. Um perfil completo gera mais confiança.',
      action: () => navigate('/dashboard/perfil'),
      actionLabel: 'Editar Perfil',
      icon: User,
      done: !!provider?.description && !!provider?.city,
    },
    {
      number: '2',
      title: 'Cadastre seus serviços',
      description: 'Vá em "Meus Serviços" e adicione os serviços que você oferece. É aqui que você faz suas postagens e divulga seu trabalho!',
      action: () => navigate('/dashboard/servicos'),
      actionLabel: 'Meus Serviços',
      icon: Briefcase,
      done: servicesCount !== null && servicesCount > 0,
    },
    {
      number: '3',
      title: 'Entre no grupo do WhatsApp',
      description: 'Participe do nosso grupo exclusivo para profissionais. Receba dicas, oportunidades e conecte-se com outros profissionais.',
      action: () => whatsappGroupUrl && window.open(whatsappGroupUrl, '_blank'),
      actionLabel: 'Entrar no Grupo',
      icon: Users,
      done: false,
      hidden: !whatsappGroupUrl,
    },
  ];

  const profileDone = !!provider?.description && !!provider?.city;
  const servicesDone = servicesCount !== null && servicesCount > 0;
  const allStepsDone = profileDone && servicesDone;

  return (
    <DashboardLayout>
      <h1 className="font-display text-2xl font-bold text-foreground">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">Bem-vindo de volta!</p>

      {/* Onboarding guide - hides when all steps complete */}
      {!allStepsDone && (
      <div className="mt-6 rounded-xl border border-accent/30 bg-accent/5 p-6">
        <h2 className="font-display text-lg font-bold text-foreground">🚀 Como funciona a plataforma</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Siga os passos abaixo para começar a receber clientes. Suas postagens e divulgação são feitas na seção <strong>"Meus Serviços"</strong>.
        </p>

        <div className="mt-4 space-y-3">
          {steps.filter(s => !s.hidden).map((step) => (
            <div
              key={step.number}
              className={`flex items-start gap-4 rounded-lg border p-4 transition-colors ${
                step.done ? 'border-accent/30 bg-accent/5' : 'border-border bg-card'
              }`}
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                step.done ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                {step.done ? '✓' : step.number}
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-foreground">{step.title}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
                <button
                  onClick={step.action}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                >
                  {step.actionLabel} <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              <step.icon className="h-5 w-5 shrink-0 text-muted-foreground" />
            </div>
          ))}
        </div>
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
