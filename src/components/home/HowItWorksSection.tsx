import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import FadeInSection from '@/components/FadeInSection';
import ParallaxSection from '@/components/ParallaxSection';
import OurStoryBanner from '@/components/OurStoryBanner';

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
    <ParallaxSection speed={0.1} orb orbColor="accent" className="relative py-16 bg-muted/30">
      <div className="container relative">
        <FadeInSection className="mb-12 text-center">
          <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary mb-3">
            Passo a passo
          </span>
          <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">Como Funciona</h2>
          <p className="mt-2 text-muted-foreground">Simples, rápido e seguro</p>
        </FadeInSection>

        <div className="relative grid gap-8 md:grid-cols-3">
          {/* Connecting line that draws progressively */}
          {steps.length >= 2 && (
            <div className="absolute top-10 left-[16.67%] right-[16.67%] hidden h-0.5 md:block overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary/20 via-accent/40 to-primary/20 rounded-full origin-left"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 1.2, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              />
              <motion.div
                className="absolute top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-accent shadow-md"
                animate={{ left: ['0%', '100%', '0%'] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
          )}

          {steps.map((item, i) => (
            <FadeInSection key={item.id} delay={i * 0.15} className="relative text-center">
              <motion.div
                className="group relative mx-auto"
                whileHover={{ scale: 1.05 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                {/* Glow effect on hover */}
                <div className="absolute inset-0 mx-auto h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100" />
                
                <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 text-4xl shadow-sm ring-1 ring-primary/10 transition-all duration-300 group-hover:ring-primary/30 group-hover:shadow-md">
                  {item.icon}
                  {/* Pulse on active step */}
                  <motion.div
                    className="absolute inset-0 rounded-2xl ring-2 ring-accent/30"
                    initial={{ opacity: 0, scale: 1 }}
                    animate={{ opacity: [0, 0.6, 0], scale: [1, 1.15, 1.3] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.6 }}
                  />
                  <motion.span
                    className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent/80 text-xs font-bold text-accent-foreground shadow-md ring-2 ring-background"
                    whileHover={{ scale: 1.2 }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.3 + i * 0.15 }}
                  >
                    {item.step}
                  </motion.span>
                </div>
              </motion.div>
              <h3 className="mt-5 font-display text-lg font-bold text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">{item.description}</p>
            </FadeInSection>
          ))}
        </div>

        <div className="mt-12">
          <OurStoryBanner variant="compact" />
        </div>
      </div>
    </ParallaxSection>
  );
};

export default HowItWorksSection;
