import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import FadeInSection from '@/components/FadeInSection';

const HowItWorksSection = () => {
  const { data: steps = [] } = useQuery({
    queryKey: ['home-steps'],
    queryFn: async () => {
      const { data } = await supabase
        .from('home_steps' as any)
        .select('*')
        .eq('active', true)
        .order('display_order');
      return (data || []) as unknown as Array<{ id: string; step: number; title: string; description: string; icon: string }>;
    },
    staleTime: 1000 * 60 * 10,
  });

  if (steps.length === 0) return null;

  return (
    <section className="py-16 bg-muted/30">
      <div className="container">
        <FadeInSection className="mb-12 text-center">
          <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary mb-3">
            Passo a passo
          </span>
          <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">Como Funciona</h2>
          <p className="mt-2 text-muted-foreground">Simples, rápido e seguro</p>
        </FadeInSection>

        <div className="relative grid gap-8 md:grid-cols-3">
          {steps.length >= 2 && (
            <div className="absolute top-10 left-[16.67%] right-[16.67%] hidden h-0.5 bg-gradient-to-r from-primary/20 via-accent/40 to-primary/20 md:block" />
          )}

          {steps.map((item, i) => (
            <FadeInSection key={item.id} delay={i * 0.15} className="relative text-center">
              <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 text-4xl shadow-sm ring-1 ring-primary/10 transition-transform duration-300 hover:scale-110">
                {item.icon}
                <span className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground shadow-md ring-2 ring-background">
                  {item.step}
                </span>
              </div>
              <h3 className="mt-5 font-display text-lg font-bold text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">{item.description}</p>
            </FadeInSection>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
