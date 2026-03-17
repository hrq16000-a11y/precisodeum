import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

const INITIAL_COUNT = 6;
const LOAD_MORE_COUNT = 4;
const MAX_VISIBLE = 10;

const FaqSection = () => {
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);

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
      <section className="bg-muted/50 py-10">
        <div className="container max-w-2xl">
          <Skeleton className="mx-auto mb-8 h-8 w-48" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="mb-3 h-14 rounded-lg" />
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
    <section className="bg-muted/50 py-10">
      <div className="container max-w-2xl">
        <h2 className="mb-8 text-center font-display text-2xl font-bold text-foreground md:text-3xl">Perguntas Frequentes</h2>

        {visibleFaqs.map((faq: any) => (
          <details key={faq.id} className="group mb-3 rounded-lg border border-border bg-card">
            <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-foreground">
              {faq.question}
            </summary>
            <p className="px-5 pb-4 text-sm text-muted-foreground">{faq.answer}</p>
          </details>
        ))}

        <div className="mt-5 flex flex-col items-center gap-3">
          {canLoadMore && (
            <Button
              variant="outline"
              onClick={() => setVisibleCount((prev) => Math.min(prev + LOAD_MORE_COUNT, maxHomeFaqs))}
            >
              Ver mais perguntas
            </Button>
          )}

          <Button variant="ghost" asChild>
            <Link to="/faq">Ver todas as perguntas e respostas</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FaqSection;
