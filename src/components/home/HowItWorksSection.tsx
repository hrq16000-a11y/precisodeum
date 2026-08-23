import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Star, MessageCircle, BadgeCheck, ArrowRight, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import FadeInSection from '@/components/FadeInSection';
import OurStoryBanner from '@/components/OurStoryBanner';
import { Button } from '@/components/ui/button';
import { useGeoCity } from '@/hooks/useGeoCity';
import { useCategoriesWithCount } from '@/hooks/useProviders';

type HomeStep = {
  id: string;
  step: number;
  title: string;
  description: string;
  icon: string;
};

// Conteúdo estratégico (anti-leilão / sem intermediação). Override sobre o
// conteúdo do banco para garantir alinhamento ao posicionamento.
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
  const navigate = useNavigate();
  const { city: geoCity } = useGeoCity();
  const { data: allCategories = [] } = useCategoriesWithCount();

  // Estado do filtro rápido (categoria + cidade) — apenas client-side, leve.
  const [quickCategory, setQuickCategory] = useState('');
  const [quickCity, setQuickCity] = useState('');

  // Carrega do banco apenas para saber se a seção está ativa.
  const { data: dbSteps = [] } = useQuery({
    queryKey: ['home-steps'],
    queryFn: async () => {
      const { data } = await supabase
        .from('home_steps' as any)
        .select('id')
        .eq('active', true)
        .order('display_order');
      return (data || []) as unknown as HomeStep[];
    },
    staleTime: 1000 * 60 * 10,
  });

  // Top categorias com contagem para o filtro rápido (apenas raízes / mais populares).
  const topCategories = useMemo(() => {
    return [...allCategories]
      .filter((c) => !c.parent_id)
      .sort((a, b) => (b.count || 0) - (a.count || 0))
      .slice(0, 12);
  }, [allCategories]);

  if (dbSteps.length === 0) return null;

  // CTA dinâmico — usa cidade detectada se disponível.
  const ctaCity = geoCity || '';
  const ctaHref = ctaCity ? `/buscar?cidade=${encodeURIComponent(ctaCity)}` : '/buscar';
  const ctaLabel = ctaCity ? `Buscar perto de ${ctaCity}` : 'Começar busca agora';

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (quickCategory) params.set('categoria', quickCategory);
    const cityToUse = quickCity.trim() || geoCity || '';
    if (cityToUse) params.set('cidade', cityToUse);
    const qs = params.toString();
    navigate(qs ? `/buscar?${qs}` : '/buscar');
  };

  return (
    <section className="relative py-8 md:py-14 bg-background">
      <div className="container relative max-w-3xl">
        <FadeInSection className="mb-5 text-center">
          <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
            Passo a passo
          </span>
          <h2 className="mt-3 font-display text-2xl font-bold text-foreground md:text-3xl">
            Como Funciona
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Simples, direto e transparente</p>
        </FadeInSection>

        {/* Cards mobile-compactos: ícone+número+título na MESMA linha; descrição abaixo. */}
        <ul className="space-y-2.5">
          {STRATEGIC_STEPS.map((item, i) => {
            const Icon = item.Icon;
            return (
              <FadeInSection key={item.step} delay={i * 0.06}>
                <li className="group rounded-2xl border border-border bg-card p-3 shadow-xs transition-all hover:shadow-md hover:border-primary/30 md:p-4">
                  {/* Linha principal — sempre única no mobile */}
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted/60 ring-1 ring-border transition-colors group-hover:bg-primary/5 group-hover:ring-primary/20 md:h-12 md:w-12">
                        <Icon className="h-5 w-5 text-primary md:h-6 md:w-6" strokeWidth={2} />
                      </div>
                      <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground shadow-sm ring-2 ring-card">
                        {item.step}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                      <h3 className="font-display text-[15px] font-bold leading-tight text-foreground md:text-base">
                        {item.title}
                      </h3>
                      {item.badge && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          <BadgeCheck className="h-3 w-3" />
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Descrição compactada — não empurra o card */}
                  <p className="mt-1.5 pl-[3.5rem] text-[13px] leading-snug text-muted-foreground md:text-sm">
                    {item.description(geoCity || undefined)}
                  </p>
                </li>
              </FadeInSection>
            );
          })}
        </ul>

        {/* CTA principal — dinâmico com cidade detectada */}
        <FadeInSection delay={0.18} className="mt-5 flex flex-col items-center gap-2">
          <Button
            asChild
            size="lg"
            className="rounded-full px-7 font-semibold uppercase tracking-wide shadow-md hover:shadow-lg"
          >
            <Link to={ctaHref}>
              {ctaCity && <MapPin className="mr-2 h-4 w-4" />}
              {ctaLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <p className="px-4 text-center text-[11px] text-muted-foreground">
            Sua conexão direta com a mão de obra local. Valorizando quem trabalha.
          </p>
        </FadeInSection>

        <div className="mt-8">
          <OurStoryBanner variant="compact" />
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
