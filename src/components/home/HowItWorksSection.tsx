import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import FadeInSection from '@/components/FadeInSection';
import ParallaxSection from '@/components/ParallaxSection';

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
    <section className="relative py-16 overflow-hidden bg-muted/30">
      {/* Decorative background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-primary/[0.02] blur-3xl" />

      <div className="container relative">
        <FadeInSection className="mb-12 text-center">
          <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary mb-3">
            Passo a passo
          </span>
          <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">Como Funciona</h2>
          <p className="mt-2 text-muted-foreground">Simples, rápido e seguro</p>
        </FadeInSection>

        <div className="relative grid gap-8 md:grid-cols-3">
          {/* Connecting line */}
          {steps.length >= 2 && (
            <div className="absolute top-10 left-[16.67%] right-[16.67%] hidden h-0.5 md:block">
              <div className="h-full bg-gradient-to-r from-primary/10 via-accent/30 to-primary/10 rounded-full" />
              {/* Animated dot */}
              <div className="absolute top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-accent shadow-sm animate-[slide-in-right_3s_ease-in-out_infinite]" />
            </div>
          )}

          {steps.map((item, i) => (
            <FadeInSection key={item.id} delay={i * 0.15} className="relative text-center">
              <div className="group relative mx-auto">
                {/* Glow effect on hover */}
                <div className="absolute inset-0 mx-auto h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100" />
                
                <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 text-4xl shadow-sm ring-1 ring-primary/10 transition-all duration-300 group-hover:scale-110 group-hover:ring-primary/30 group-hover:shadow-md">
                  {item.icon}
                  <span className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent/80 text-xs font-bold text-accent-foreground shadow-md ring-2 ring-background">
                    {item.step}
                  </span>
                </div>
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
