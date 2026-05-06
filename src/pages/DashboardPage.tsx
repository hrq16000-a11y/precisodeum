import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Briefcase, User, ArrowRight, Users, Settings, PlusCircle, Megaphone, Layout, Star, MessageSquare, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSettingValue } from '@/hooks/useSiteSettings';
import { supabase } from '@/integrations/supabase/client';

const DashboardPage = () => {
  const { user, profile, provider, loading } = useAuth();
  const navigate = useNavigate();
  const whatsappGroupUrl = useSettingValue('whatsapp_group_url');
  const [servicesCount, setServicesCount] = useState<number | null>(null);
  const [leadsCount, setLeadsCount] = useState<number>(0);
  const [jobsCount, setJobsCount] = useState<number>(0);
  const [guideOpen, setGuideOpen] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      // Small delay to avoid redirect race with auth state propagation
      const timer = setTimeout(() => navigate('/login', { replace: true }), 200);
      return () => clearTimeout(timer);
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!provider) return;
    Promise.all([
      supabase.from('services').select('id', { count: 'exact', head: true }).eq('provider_id', provider.id),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('provider_id', provider.id),
    ]).then(([sRes, lRes]) => {
      setServicesCount(sRes.count ?? 0);
      setLeadsCount(lRes.count ?? 0);
    });
  }, [provider]);

  useEffect(() => {
    if (!user) return;
    supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
      .then(({ count }) => setJobsCount(count ?? 0));
  }, [user]);

  if (loading) return <DashboardLayout><p className="text-muted-foreground">Carregando...</p></DashboardLayout>;

  const profileType = profile?.profile_type || 'client';
  const isClient = profileType === 'client';
  const isProvider = profileType === 'provider';
  const isRH = profileType === 'rh';

  const profileDone = !!provider?.description && !!provider?.city;
  const servicesDone = servicesCount !== null && servicesCount > 0;

  // ---- CLIENT DASHBOARD ----
  if (isClient) {
    return (
      <DashboardLayout>
        <h1 className="font-display text-2xl font-bold text-foreground">Olá, {profile?.full_name?.split(' ')[0] || 'Bem-vindo'}!</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sua conta de cliente</p>

        <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-foreground">Conta Cliente</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Como cliente, você pode buscar profissionais, visualizar perfis e entrar em contato por WhatsApp.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 grid-cols-1 sm:grid-cols-2">
          <Card className="group cursor-pointer p-5 transition-all hover:shadow-md hover:border-accent/40" onClick={() => navigate('/buscar')}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <Eye className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Buscar Profissionais</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Encontre o profissional ideal na sua cidade</p>
              </div>
            </div>
          </Card>

          <Card className="group cursor-pointer p-5 transition-all hover:shadow-md hover:border-accent/40" onClick={() => navigate('/vagas')}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <Megaphone className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Ver Vagas</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Confira oportunidades disponíveis</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="mt-6 rounded-lg border border-accent/20 bg-accent/5 p-4">
          <p className="text-sm text-foreground font-medium">Quer oferecer serviços?</p>
          <p className="text-xs text-muted-foreground mt-1">
            Altere o tipo da sua conta para "Profissional" na página de perfil e comece a divulgar seus serviços.
          </p>
          <button
            onClick={() => navigate('/dashboard/perfil')}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
          >
            Alterar tipo de conta <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </DashboardLayout>
    );
  }

  // ---- RH DASHBOARD ----
  if (isRH) {
    return (
      <DashboardLayout>
        <h1 className="font-display text-2xl font-bold text-foreground">Painel RH</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gerencie vagas e recrutamento</p>

        <div className="mt-6 rounded-xl border border-purple-200 bg-purple-50/50 p-5 dark:border-purple-800 dark:bg-purple-900/20">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600">
              <Megaphone className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-foreground">Conta Agência / RH</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Publique vagas com auto-aprovação, acesse perfis de profissionais e gerencie processos seletivos.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="group cursor-pointer p-5 transition-all hover:shadow-md hover:border-accent/40" onClick={() => navigate('/dashboard/vagas')}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                <Megaphone className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Minhas Vagas</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Gerencie suas vagas publicadas</p>
                {jobsCount > 0 && <span className="inline-block mt-1 text-xs font-medium text-accent">{jobsCount} vaga{jobsCount !== 1 ? 's' : ''}</span>}
              </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); navigate('/dashboard/vagas'); }}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
              <PlusCircle className="h-3.5 w-3.5" /> Publicar nova vaga
            </button>
          </Card>

          <Card className="group cursor-pointer p-5 transition-all hover:shadow-md hover:border-accent/40" onClick={() => navigate('/buscar')}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <Eye className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Buscar Profissionais</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Encontre profissionais para suas vagas</p>
              </div>
            </div>
          </Card>

          <Card className="group cursor-pointer p-5 transition-all hover:shadow-md hover:border-accent/40" onClick={() => navigate('/dashboard/comunidade')}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Comunidade</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Conecte-se com a comunidade</p>
              </div>
            </div>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // ---- PROVIDER DASHBOARD ----
  const providerSteps = [
    {
      number: '1',
      title: 'Complete seu perfil',
      description: 'Adicione sua foto, descrição profissional, cidade e contato. Um perfil completo gera mais confiança e aparece com destaque na plataforma.',
      action: () => navigate('/dashboard/perfil'),
      actionLabel: 'Editar Perfil',
      icon: User,
      done: profileDone,
    },
    {
      number: '2',
      title: 'Cadastre seus serviços',
      description: 'Adicione os serviços que você oferece, com imagens e descrições. Profissionais com serviços e imagens recebem o selo "Perfil Completo".',
      action: () => navigate('/dashboard/servicos'),
      actionLabel: 'Meus Serviços',
      icon: Briefcase,
      done: servicesDone,
    },
    {
      number: '3',
      title: 'Personalize sua página',
      description: 'Configure sua landing page profissional — escolha temas, cores, organize seções e adicione portfólio.',
      action: () => navigate('/dashboard/minha-pagina'),
      actionLabel: 'Minha Página',
      icon: Layout,
      done: false,
    },
    {
      number: '4',
      title: 'Entre no grupo do WhatsApp',
      description: 'Participe do nosso grupo exclusivo para profissionais e receba dicas.',
      action: () => whatsappGroupUrl && window.open(whatsappGroupUrl, '_blank'),
      actionLabel: 'Entrar no Grupo',
      icon: Users,
      done: false,
      hidden: !whatsappGroupUrl,
    },
  ];

  const allStepsDone = profileDone && servicesDone;

  return (
    <DashboardLayout>
      <h1 className="font-display text-2xl font-bold text-foreground">
        Olá, {profile?.full_name?.split(' ')[0] || 'Profissional'}!
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Seu painel profissional</p>

      {/* Dominant CTA when no services */}
      {servicesCount !== null && servicesCount === 0 && (
        <div className="mt-4 rounded-xl border-2 border-accent bg-accent/10 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <PlusCircle className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-foreground">Crie seu primeiro serviço!</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Publique seus serviços para que clientes possam encontrá-lo na plataforma.</p>
          </div>
          <Button variant="accent" size="sm" onClick={() => navigate('/dashboard/servicos')} className="shrink-0">
            <PlusCircle className="mr-1 h-4 w-4" /> Criar Serviço
          </Button>
        </div>
      )}

      {/* Stats row */}
      <div className="mt-6 grid gap-3 grid-cols-2 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <Briefcase className="h-4 w-4 text-accent" />
          <p className="mt-2 font-display text-2xl font-bold text-foreground">{servicesCount ?? 0}</p>
          <p className="text-[11px] text-muted-foreground">{servicesCount === 0 ? 'Nenhum serviço ainda' : 'Serviços'}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <MessageSquare className="h-4 w-4 text-accent" />
          <p className="mt-2 font-display text-2xl font-bold text-foreground">{leadsCount}</p>
          <p className="text-[11px] text-muted-foreground">{leadsCount === 0 ? 'Nenhum lead ainda' : 'Leads'}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <Star className="h-4 w-4 text-accent" />
          <p className="mt-2 font-display text-2xl font-bold text-foreground">{provider?.rating_avg ? Number(provider.rating_avg).toFixed(1) : '0'}</p>
          <p className="text-[11px] text-muted-foreground">{!provider?.rating_avg || Number(provider.rating_avg) === 0 ? 'Sem avaliações ainda' : 'Avaliação'}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <Megaphone className="h-4 w-4 text-accent" />
          <p className="mt-2 font-display text-2xl font-bold text-foreground">{jobsCount}</p>
          <p className="text-[11px] text-muted-foreground">{jobsCount === 0 ? 'Nenhuma vaga ainda' : 'Vagas'}</p>
        </div>
      </div>

      {/* Quick Access */}
      <div className="mt-6">
        <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Acesso Rápido</h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="group cursor-pointer p-5 transition-all hover:shadow-md hover:border-accent/40 hover:scale-[1.01]" onClick={() => navigate('/dashboard/servicos')}>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                <Settings className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-foreground">Meus Serviços</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Gerencie seus serviços cadastrados</p>
                {servicesCount !== null && servicesCount > 0 && (
                  <span className="inline-block mt-1.5 text-xs font-medium text-accent">{servicesCount} ativo{servicesCount !== 1 ? 's' : ''}</span>
                )}
              </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); navigate('/dashboard/servicos'); }}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
              <PlusCircle className="h-3.5 w-3.5" /> Adicionar novo serviço
            </button>
          </Card>

          <Card className="group cursor-pointer p-5 transition-all hover:shadow-md hover:border-accent/40 hover:scale-[1.01]" onClick={() => navigate('/dashboard/vagas')}>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                <Megaphone className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-foreground">Vagas</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Visualize e publique oportunidades</p>
              </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); navigate('/dashboard/vagas'); }}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
              <PlusCircle className="h-3.5 w-3.5" /> Publicar vaga
            </button>
          </Card>

          {provider?.slug && (
            <Card className="group cursor-pointer p-5 transition-all hover:shadow-md hover:border-primary/40 hover:scale-[1.01] border-dashed" onClick={() => navigate(`/profissional/${provider.slug}`)}>
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Eye className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-foreground">Ver Minha Página</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Veja como seu perfil aparece para os clientes</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Onboarding guide - always visible, collapsible */}
      <div className="mt-6 rounded-xl border border-accent/30 bg-accent/5 p-4 sm:p-6">
        <button
          onClick={() => setGuideOpen(!guideOpen)}
          className="flex w-full items-center justify-between text-left"
        >
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">
              🚀 Como funciona a plataforma
              {allStepsDone && <span className="ml-2 text-xs font-normal text-accent">✓ Tudo concluído</span>}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {allStepsDone
                ? 'Parabéns! Seu perfil está completo. Consulte os passos sempre que precisar.'
                : 'Siga os passos abaixo para começar a receber clientes.'}
            </p>
          </div>
          {guideOpen ? <ChevronUp className="h-5 w-5 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />}
        </button>

        {guideOpen && (
          <div className="mt-4 space-y-3">
            {providerSteps.filter(s => !s.hidden).map((step) => (
              <div
                key={step.number}
                className={`flex items-start gap-3 rounded-lg border p-3 transition-colors sm:gap-4 sm:p-4 ${
                  step.done ? 'border-accent/30 bg-accent/5' : 'border-border bg-card'
                }`}
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  step.done ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {step.done ? '✓' : step.number}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-foreground">{step.title}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground break-words">{step.description}</p>
                  <button
                    onClick={step.action}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                  >
                    {step.actionLabel} <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
                <step.icon className="h-5 w-5 shrink-0 text-muted-foreground hidden sm:block" />
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;
