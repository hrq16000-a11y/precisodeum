import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import FadeInSection from '@/components/FadeInSection';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { useJsonLd } from '@/hooks/useJsonLd';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { HelpCircle } from 'lucide-react';
import { useMemo } from 'react';

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

  // FAQ Schema JSON-LD for rich snippets
  const faqJsonLd = useMemo(() => {
    if (!faqs.length) return null;
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((faq: any) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    };
  }, [faqs]);

  useJsonLd(faqJsonLd);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <FadeInSection className="bg-gradient-to-br from-primary/10 to-accent/10 py-12">
          <div className="container text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, type: 'spring' }}
            >
              <HelpCircle className="mx-auto h-12 w-12 text-primary" />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mt-4 font-display text-3xl font-bold text-foreground md:text-4xl"
            >
              Perguntas Frequentes
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="mt-2 text-muted-foreground"
            >
              Encontre respostas para as dúvidas mais comuns sobre a plataforma
            </motion.p>
          </div>
        </FadeInSection>

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
                {faqs.map((faq: any, index: number) => (
                  <motion.div
                    key={faq.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: index * 0.05 }}
                  >
                    <AccordionItem
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
                  </motion.div>
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
