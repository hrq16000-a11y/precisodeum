import { Quote, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StarRating from '@/components/StarRating';
import FadeInSection from '@/components/FadeInSection';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

const ratingGradients: Record<number, string> = {
  5: 'from-amber-400/30 to-orange-500/30',
  4: 'from-primary/25 to-accent/25',
  3: 'from-blue-400/20 to-cyan-400/20',
  2: 'from-muted-foreground/20 to-muted/30',
  1: 'from-muted-foreground/15 to-muted/20',
};

const TestimonialsSection = () => {
  const { data: testimonials = [] } = useQuery({
    queryKey: ['home-testimonials'],
    queryFn: async () => {
      const { data } = await supabase
        .from('home_testimonials' as any)
        .select('*')
        .eq('active', true)
        .order('display_order');
      return (data || []) as unknown as Array<{ id: string; name: string; city: string; text: string; rating: number }>;
    },
    staleTime: 1000 * 60 * 10,
  });

  const [page, setPage] = useState(0);
  const [direction, setDirection] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const perPage = 3;
  const totalPages = Math.ceil(testimonials.length / perPage);

  const goTo = useCallback((p: number, dir: number) => {
    setDirection(dir);
    setPage(p);
  }, []);

  const next = useCallback(() => goTo((page + 1) % totalPages, 1), [page, totalPages, goTo]);
  const prev = useCallback(() => goTo((page - 1 + totalPages) % totalPages, -1), [page, totalPages, goTo]);

  // Auto-play
  useEffect(() => {
    if (totalPages <= 1) return;
    timerRef.current = setInterval(next, 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [next, totalPages]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(next, 5000);
  }, [next]);

  if (testimonials.length === 0) return null;

  const visible = testimonials.slice(page * perPage, (page + 1) * perPage);
  const avgRating = (testimonials.reduce((sum, t) => sum + t.rating, 0) / testimonials.length).toFixed(1);

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -80 : 80, opacity: 0 }),
  };

  return (
    <section className="relative py-16 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-muted/50 via-background to-muted/30" />
      <div className="absolute top-0 left-1/4 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-accent/5 blur-3xl" />

      <div className="container relative">
        <FadeInSection className="mb-10 text-center">
          <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary mb-3">
            ⭐ {avgRating} de avaliação média
          </span>
          <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">O que dizem nossos usuários</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {testimonials.length} depoimentos reais
          </p>
        </FadeInSection>

        <AnimatePresence custom={direction} mode="wait">
          <motion.div
            key={page}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="grid gap-5 md:grid-cols-3"
          >
            {visible.map((t, i) => {
              const grad = ratingGradients[Math.round(t.rating)] || ratingGradients[3];
              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.35 }}
                  className="group relative rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-6 shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 hover:border-primary/20"
                >
                  <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  <Quote className="absolute top-4 right-4 h-10 w-10 text-primary/[0.07] transition-all group-hover:text-primary/15 group-hover:scale-110" />

                  <StarRating rating={t.rating} showValue={false} size={14} />
                  <p className="mt-4 text-sm text-foreground/90 leading-relaxed italic">"{t.text}"</p>

                  <div className="mt-5 flex items-center gap-3 border-t border-border/50 pt-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${grad} text-sm font-bold text-primary shadow-sm ring-2 ring-background`}>
                      {t.name.charAt(0)}
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold text-foreground">{t.name}</span>
                      <span className="block text-xs text-muted-foreground">{t.city}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>

        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => { prev(); resetTimer(); }}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex gap-1.5">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => { goTo(i, i > page ? 1 : -1); resetTimer(); }}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === page ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/20 hover:bg-muted-foreground/40'
                  }`}
                />
              ))}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => { next(); resetTimer(); }}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </section>
  );
};

export default TestimonialsSection;
