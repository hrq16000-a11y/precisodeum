import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Check, Crown, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

const plans = [
  {
    name: 'Gratuito',
    price: 'R$ 0',
    period: '/mês',
    features: ['Perfil básico', 'Listado no diretório', 'Até 3 serviços'],
  },
  {
    name: 'PRO',
    price: 'R$ 49',
    period: '/mês',
    highlight: true,
    features: ['Perfil destacado', 'Botão WhatsApp', 'Ranking superior', 'Serviços ilimitados', 'Badge PRO'],
  },
  {
    name: 'Premium',
    price: 'R$ 99',
    period: '/mês',
    features: ['Topo da busca', 'Perfil premium', 'Destaque na home', 'Relatórios avançados', 'Suporte prioritário'],
  },
];

const DashboardPlanPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [loading, user, navigate]);

  return (
    <DashboardLayout>
      <h1 className="font-display text-2xl font-bold text-foreground">Plano de Assinatura</h1>
      <p className="mt-1 text-sm text-muted-foreground">Escolha o plano ideal para o seu negócio</p>

      {/* Promotional banner */}
      <div className="mt-6 rounded-xl border border-accent/30 bg-accent/10 p-4 flex items-center gap-3">
        <Gift className="h-6 w-6 text-accent shrink-0" />
        <div>
          <p className="text-sm font-semibold text-foreground">🎉 Promoção de lançamento!</p>
          <p className="text-xs text-muted-foreground">
            Todos os cadastros estão com acesso <strong className="text-accent">Premium gratuito</strong> por tempo limitado. Aproveite todos os recursos sem custo!
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {plans.map(plan => {
          const isGratuito = plan.name === 'Gratuito';
          const isPremium = plan.name === 'Premium';

          return (
            <div
              key={plan.name}
              className={`relative rounded-xl border p-6 shadow-card ${
                isPremium
                  ? 'border-accent bg-accent/5 ring-2 ring-accent/30'
                  : 'border-border bg-card'
              }`}
            >
              {isPremium && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">
                  <Crown className="h-3 w-3" /> Seu plano atual
                </div>
              )}

              <h3 className="font-display text-lg font-bold text-foreground">{plan.name}</h3>
              <div className="mt-2">
                {isPremium ? (
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-3xl font-bold text-foreground line-through opacity-40">
                      {plan.price}
                    </span>
                    <span className="font-display text-3xl font-bold text-accent">R$ 0</span>
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  </div>
                ) : (
                  <>
                    <span className="font-display text-3xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  </>
                )}
              </div>

              {isPremium && (
                <p className="mt-1 text-xs text-accent font-medium">Grátis durante o lançamento</p>
              )}

              <ul className="mt-6 space-y-3">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                    <Check className={`h-4 w-4 ${isPremium ? 'text-accent' : 'text-muted-foreground'}`} /> {f}
                  </li>
                ))}
              </ul>

              {isPremium ? (
                <Button variant="accent" className="mt-6 w-full" disabled>
                  <Crown className="mr-1 h-4 w-4" /> Ativo
                </Button>
              ) : isGratuito ? (
                <Button variant="outline" className="mt-6 w-full" disabled>
                  Incluído
                </Button>
              ) : (
                <Button variant="outline" className="mt-6 w-full opacity-60" disabled>
                  Em breve
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </DashboardLayout>
  );
};

export default DashboardPlanPage;
