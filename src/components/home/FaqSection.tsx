import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

const FaqSection = () => {
  const { data: faqs = [], isLoading } = useQuery({
    queryKey: ['faqs-home'],
    queryFn: async () => {
      const { data } = await supabase
        .from('faqs' as any)
        .select('*')
        .eq('active', true)
        .order('display_order');
      return (data || []) as any[];
    },
  });

  if (isLoading) {
    return (
      <section className="bg-muted/50 py-14">
        <div className="container max-w-2xl">
          <Skeleton className="mx-auto h-8 w-48 mb-8" />
          {[1,2,3].map(i => <Skeleton key={i} className="h-14 mb-3 rounded-lg" />)}
        </div>
      </section>
    );
  }

  if (faqs.length === 0) return null;

  return (
    <section className="bg-muted/50 py-14">
      <div className="container max-w-2xl">
        <h2 className="mb-8 text-center font-display text-2xl font-bold text-foreground md:text-3xl">Perguntas Frequentes</h2>
        {faqs.map((faq: any) => (
          <details key={faq.id} className="group mb-3 rounded-lg border border-border bg-card">
            <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-foreground">
              {faq.question}
            </summary>
            <p className="px-5 pb-4 text-sm text-muted-foreground">{faq.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
};

export default FaqSection;
