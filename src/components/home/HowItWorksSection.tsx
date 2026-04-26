import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, Star, MessageCircle, BadgeCheck, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import FadeInSection from '@/components/FadeInSection';
import OurStoryBanner from '@/components/OurStoryBanner';
import { Button } from '@/components/ui/button';
import { useGeoCity } from '@/hooks/useGeoCity';

type HomeStep = {
  id: string;
  step: number;
  title: string;
  description: string;
  icon: string;
};

// Conteúdo estratégico (anti-leilão / sem intermediação). Usado como override
// sobre o que vem do banco, garantindo o copy alinhado ao posicionamento.
const STRATEGIC_STEPS: Array<{
  step: number;
  title: string;
  description: (city?: string) => string;
  Icon: typeof Search;
  badge?: string;
}> = [
  {
    step: 1,
    title: 'Busque o serviço',
    description: (city) =>
      city
        ? `Refine por categoria e bairro em ${city}. Encontre exatamente o que precisa.`
        : 'Refine por categoria e cidade em segundos. Encontre exatamente o que precisa.',
    Icon: Search,
  },
  {
    step: 2,
    title: 'Avalie profissionais Top',
    description: () =>
      'Veja avaliações, portfólios detalhados e faixas de valor sugerido por profissionais verificados.',
    Icon: Star,
    badge: 'Perfil Top',
  },
  {
    step: 3,
    title: 'Faça contato direto',
    description: () =>
      'Negocie tudo direto pelo WhatsApp ou formulário. Sem taxas, sem intermediação.',
    Icon: MessageCircle,
  },
];

const HowItWorksSection = () => {
  const { city: geoCity } = useGeoCity();

  // Carrega do banco apenas para saber se a seção está ativa / quantos passos exibir.
  const { data: dbSteps = [] } = useQuery({
    queryKey: ['home-steps'],
    queryFn: async () => {
      const { data } = await supabase
        .from('home_steps' as any)
        .select('*')
        .eq('active', true)
        .order('display_order');
      return (data || []) as unknown as HomeStep[];
    },
    staleTime: 1000 * 60 * 10,
  });

  // Se admin desativou todos os passos, escondemos a seção.
  if (dbSteps.length === 0) return null;

  const ctaHref = geoCity
    ? `/buscar?cidade=${encodeURIComponent(geoCity)}`
    : '/buscar';

  return (
    <section className="relative py-10 md:py-14 bg-background">
      <div className="container relative max-w-3xl">
        <FadeInSection className="mb-6 text-center">
          <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
            Passo a passo
          </span>
          <h2 className="mt-3 font-display text-2xl font-bold text-foreground md:text-3xl">
            Como Funciona
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Simples, direto e transparente</p>
        </FadeInSection>

        {/* Cards horizontais compactos: ícone à esquerda, texto à direita */}
        <ul className="space-y-3">
          {STRATEGIC_STEPS.map((item, i) => {
            const Icon = item.Icon;
            return (
              <FadeInSection key={item.step} delay={i * 0.08}>
                <li className="group flex items-start gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/30">
                  {/* Ícone + número */}
                  <div className="relative shrink-0">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted/60 ring-1 ring-border transition-colors group-hover:bg-primary/5 group-hover:ring-primary/20">
                      <Icon className="h-7 w-7 text-primary" strokeWidth={2} />
                    </div>
                    <span className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground shadow-md ring-2 ring-card">
                      {item.step}
                    </span>
                  </div>

                  {/* Conteúdo */}
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-base font-bold text-foreground md:text-lg">
                        {item.title}
                      </h3>
                      {item.badge && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          <BadgeCheck className="h-3 w-3" />
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {item.description(geoCity || undefined)}
                    </p>
                  </div>
                </li>
              </FadeInSection>
            );
          })}
        </ul>

        {/* CTA final — fecha o fluxo do "como funciona" */}
        <FadeInSection delay={0.25} className="mt-6 flex flex-col items-center gap-2">
          <Button
            asChild
            size="lg"
            className="rounded-full px-8 font-semibold uppercase tracking-wide shadow-md hover:shadow-lg"
          >
            <Link to={ctaHref}>
              Começar busca agora
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <p className="px-4 text-center text-[11px] text-muted-foreground">
            Sua conexão direta com a mão de obra local. Valorizando quem trabalha.
          </p>
        </FadeInSection>

        <div className="mt-10">
          <OurStoryBanner variant="compact" />
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
