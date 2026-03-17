import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { HelpCircle } from 'lucide-react';

const FaqPage = () => {
  useSeoHead({
    title: 'Perguntas Frequentes – Preciso de um',
    description: 'Tire suas dúvidas sobre a plataforma Preciso de um. Saiba como encontrar profissionais, cadastrar serviços, plano Premium e muito mais.',
    canonical: `${SITE_BASE_URL}/faq`,
  });

  const { data: faqs = [], isLoading } = useQuery({
    queryKey: ['faq-page-all'],
    queryFn: async () => {
      const { data } = await supabase
        .from('faqs')
        .select('*')
        .eq('active', true)
        .order('display_order');
      return data || [];
    },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <section className="bg-gradient-to-br from-primary/10 to-accent/10 py-12">
          <div className="container text-center">
            <HelpCircle className="mx-auto h-12 w-12 text-primary" />
            <h1 className="mt-4 font-display text-3xl font-bold text-foreground md:text-4xl">
              Perguntas Frequentes
            </h1>
            <p className="mt-2 text-muted-foreground">
              Encontre respostas para as dúvidas mais comuns sobre a plataforma
            </p>
          </div>
        </section>

        <section className="py-10">
          <div className="container max-w-3xl">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            ) : (
              <Accordion type="single" collapsible className="space-y-3">
                {faqs.map((faq: any) => (
                  <AccordionItem
                    key={faq.id}
                    value={faq.id}
                    className="rounded-xl border border-border bg-card px-5 shadow-card"
                  >
                    <AccordionTrigger className="text-left text-sm font-semibold text-foreground hover:no-underline sm:text-base">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default FaqPage;
