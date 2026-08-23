import { useMemo } from 'react';
import { HelpCircle, BadgeDollarSign, ShieldCheck } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useJsonLd } from '@/hooks/useJsonLd';
import {
  buildCategoryIntentFaq,
  buildPricingContext,
} from '@/lib/categoryIntentContent';

interface Props {
  categorySlug: string;
  categoryName: string;
  city?: string | null;
}

/**
 * Bloco de conteúdo rico por categoria: FAQ por intenção de busca
 * ("o que é", "como funciona", "procedimentos", "onde encontrar") +
 * contexto de faixas de preço regionais com valorização da mão de obra.
 */
const CategoryIntentContent = ({ categorySlug, categoryName, city }: Props) => {
  const faq = useMemo(
    () => buildCategoryIntentFaq(categoryName, city),
    [categoryName, city],
  );
  const pricing = useMemo(
    () => buildPricingContext(categorySlug, categoryName, city),
    [categorySlug, categoryName, city],
  );

  const faqLd = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    }),
    [faq],
  );

  useJsonLd(faqLd, `json-ld-faq-intent-${categorySlug}`);

  return (
    <section className="container my-10 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
      <div className="rounded-3xl border border-border bg-card p-5 md:p-7">
        <div className="flex items-center gap-2 text-primary">
          <HelpCircle className="h-4 w-4" />
          <h2 className="font-display text-lg font-bold text-foreground md:text-xl">
            Tudo sobre {categoryName.toLowerCase()}
            {city ? ` em ${city}` : ''}
          </h2>
        </div>
        <Accordion type="single" collapsible className="mt-3">
          {faq.map((item, i) => (
            <AccordionItem key={item.question} value={`intent-${i}`}>
              <AccordionTrigger className="text-left text-sm font-semibold">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      <div className="rounded-3xl border border-accent/20 bg-accent/5 p-5 md:p-7">
        <div className="flex items-center gap-2 text-accent">
          <BadgeDollarSign className="h-4 w-4" />
          <h2 className="font-display text-lg font-bold text-foreground md:text-xl">
            {pricing.heading}
          </h2>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{pricing.range}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{pricing.regional}</p>

        <div className="mt-4 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-4 w-4" />
            <h3 className="text-sm font-bold text-foreground">Valorize a mão de obra de qualidade</h3>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{pricing.valuation}</p>
          <ul className="mt-3 space-y-1.5">
            {pricing.bullets.map((b) => (
              <li key={b} className="flex gap-2 text-xs text-muted-foreground">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default CategoryIntentContent;
