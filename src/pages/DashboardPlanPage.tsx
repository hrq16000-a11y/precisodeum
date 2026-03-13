import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

const plans = [
  {
    name: 'Gratuito', price: 'R$ 0', period: '/mês', current: true,
    features: ['Perfil básico', 'Listado no diretório', 'Até 3 serviços'],
  },
  {
    name: 'PRO', price: 'R$ 49', period: '/mês', current: false, highlight: true,
    features: ['Perfil destacado', 'Botão WhatsApp', 'Ranking superior', 'Serviços ilimitados', 'Badge PRO'],
  },
  {
    name: 'Premium', price: 'R$ 99', period: '/mês', current: false,
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

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {plans.map(plan => {
          const isComingSoon = !plan.current;
          return (
            <div key={plan.name} className={`relative rounded-xl border p-6 shadow-card ${plan.highlight ? 'border-accent bg-accent/5 ring-2 ring-accent/20' : 'border-border bg-card'} ${isComingSoon ? 'opacity-60' : ''}`}>
              {isComingSoon && (
                <div className="absolute top-3 right-3 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                  Em breve
                </div>
              )}
              <h3 className="font-display text-lg font-bold text-foreground">{plan.name}</h3>
              <div className="mt-2">
                <span className="font-display text-3xl font-bold text-foreground">{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.period}</span>
              </div>
              <ul className="mt-6 space-y-3">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                    <Check className="h-4 w-4 text-accent" /> {f}
                  </li>
                ))}
              </ul>
              <Button variant={plan.current ? 'outline' : 'accent'} className="mt-6 w-full" disabled>
                {plan.current ? 'Plano Atual' : 'Em breve'}
              </Button>
            </div>
          );
        })}
      </div>
    </DashboardLayout>
  );
};

export default DashboardPlanPage;
