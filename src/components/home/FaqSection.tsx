import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { HelpCircle, ChevronDown, ArrowRight } from 'lucide-react';
import FadeInSection from '@/components/FadeInSection';

const INITIAL_COUNT = 6;
const LOAD_MORE_COUNT = 4;
const MAX_VISIBLE = 10;

const FaqSection = () => {
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: faqs = [], isLoading } = useQuery({
    queryKey: ['faqs-home'],
    queryFn: async () => {
      const { data } = await supabase
        .from('faqs' as any)
        .select('*')
        .eq('active', true);
      return (data || []) as any[];
    },
  });

  const randomizedFaqs = useMemo(() => {
    const arr = [...faqs];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, MAX_VISIBLE);
  }, [faqs]);

  useEffect(() => {
    setVisibleCount(INITIAL_COUNT);
  }, [randomizedFaqs.length]);

  if (isLoading) {
    return (
      <section className="bg-gradient-to-b from-muted/50 to-background py-12">
        <div className="container max-w-2xl">
          <Skeleton className="mx-auto mb-8 h-8 w-48" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="mb-3 h-14 rounded-xl" />
          ))}
        </div>
      </section>
    );
  }

  if (randomizedFaqs.length === 0) return null;

  const visibleFaqs = randomizedFaqs.slice(0, visibleCount);
  const maxHomeFaqs = Math.min(MAX_VISIBLE, randomizedFaqs.length);
  const canLoadMore = visibleCount < maxHomeFaqs;

  return (
    <section className="bg-gradient-to-b from-muted/50 to-background py-12">
      <div className="container max-w-2xl">
        <FadeInSection className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-3">
            <HelpCircle className="h-3.5 w-3.5" />
            Tire suas dúvidas
          </div>
          <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">
            Perguntas Frequentes
          </h2>
        </FadeInSection>

        <div className="space-y-2.5">
          {visibleFaqs.map((faq: any, idx: number) => {
            const isOpen = openId === faq.id;
            return (
              <FadeInSection key={faq.id} delay={idx * 0.04}>
                <div className="rounded-xl border border-border bg-card overflow-hidden transition-all duration-300 hover:border-primary/20">
                  <button
                    onClick={() => setOpenId(isOpen ? null : faq.id)}
                    className="flex w-full items-center justify-between px-5 py-4 text-left"
                  >
                    <span className="text-sm font-semibold text-foreground pr-4">
                      {faq.question}
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <div
                    className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
                  >
                    <p className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </FadeInSection>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col items-center gap-3">
          {canLoadMore && (
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setVisibleCount((prev) => Math.min(prev + LOAD_MORE_COUNT, maxHomeFaqs))}
            >
              Ver mais perguntas
            </Button>
          )}
          <Button variant="ghost" size="sm" className="gap-1" asChild>
            <Link to="/faq">Ver todas as perguntas <ArrowRight className="h-3 w-3" /></Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FaqSection;
