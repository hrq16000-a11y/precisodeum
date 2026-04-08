import { ArrowRight, Megaphone, Sparkles, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type CtaBlock = {
  id: string;
  title: string;
  subtitle: string;
  button_text: string;
  button_link: string;
  icon: string;
  variant: string;
  section: string;
};

const iconMap: Record<string, React.ElementType> = {
  Sparkles,
  Megaphone,
  Search,
};

const CtaSection = () => {
  const { data: blocks = [] } = useQuery({
    queryKey: ['home-cta-blocks'],
    queryFn: async () => {
      const { data } = await supabase
        .from('home_cta_blocks' as any)
        .select('*')
        .eq('active', true)
        .order('display_order');
      return (data || []) as unknown as CtaBlock[];
    },
    staleTime: 1000 * 60 * 10,
  });

  const midBlocks = blocks.filter(b => b.section === 'mid');
  const finalBlock = blocks.find(b => b.section === 'final');

  if (blocks.length === 0) return null;

  return (
    <>
      {/* Mid CTA - Dynamic cards */}
      {midBlocks.length > 0 && (
        <section className="py-12">
          <div className="container">
            <div className={`grid gap-5 ${midBlocks.length >= 2 ? 'md:grid-cols-2' : ''}`}>
              {midBlocks.map((block, i) => {
                const Icon = iconMap[block.icon] || Sparkles;
                const isAccent = block.variant === 'accent' || i % 2 === 1;
                const colorBase = isAccent ? 'accent' : 'primary';

                return (
                  <motion.div
                    key={block.id}
                    initial={{ opacity: 0, y: 30, scale: 0.97 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ duration: 0.5, delay: i * 0.12, ease: [0.25, 0.46, 0.45, 0.94] }}
                  >
                    <div className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br from-${colorBase}/5 to-${colorBase}/10 border border-${colorBase}/20 p-8 text-center transition-all duration-500 hover:border-${colorBase}/40 hover:shadow-lg`}>
                      {/* Animated background circle */}
                      <motion.div
                        className={`absolute -top-10 -right-10 h-32 w-32 rounded-full bg-${colorBase}/5`}
                        animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
                        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
                      />
                      {/* Shine sweep */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 ease-out" />

                      <h2 className="relative font-display text-xl font-bold text-foreground md:text-2xl">
                        <Icon className={`inline h-5 w-5 mr-1 text-${colorBase}`} />
                        {block.title}
                      </h2>
                      <p className="relative mx-auto mt-3 max-w-sm text-sm text-muted-foreground leading-relaxed">
                        {block.subtitle}
                      </p>
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.97 }}
                        className="relative mt-5 inline-block"
                      >
                        <Button variant="accent" size="lg" className="rounded-full shadow-md" asChild>
                          <Link to={block.button_link}>{block.button_text} <ArrowRight className="h-4 w-4" /></Link>
                        </Button>
                      </motion.div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Final CTA */}
      {finalBlock && (
        <section className="py-14 bg-gradient-to-br from-primary/5 via-background to-accent/5 relative overflow-hidden">
          {/* Floating particles */}
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            {[...Array(4)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full bg-accent/10"
                style={{
                  width: 8 + i * 6,
                  height: 8 + i * 6,
                  left: `${20 + i * 20}%`,
                  top: `${30 + (i % 2) * 30}%`,
                }}
                animate={{ y: [0, -15, 0], opacity: [0.2, 0.5, 0.2] }}
                transition={{ duration: 4 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.5 }}
              />
            ))}
          </div>

          <div className="container text-center relative">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">
                {finalBlock.title}
              </h2>
              <p className="mx-auto mt-3 max-w-md text-muted-foreground">
                {finalBlock.subtitle}
              </p>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
              >
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                  <Button variant="hero" size="xl" className="rounded-full shadow-lg" asChild>
                    <Link to={finalBlock.button_link}>{finalBlock.button_text}</Link>
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                  <Button variant="outline" size="xl" className="rounded-full" asChild>
                    <Link to="/cadastro">Sou Profissional</Link>
                  </Button>
                </motion.div>
              </motion.div>
            </motion.div>
          </div>
        </section>
      )}
    </>
  );
};

export default CtaSection;
