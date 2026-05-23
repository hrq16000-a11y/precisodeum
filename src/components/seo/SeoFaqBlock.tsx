/**
 * SeoFaqBlock — bloco de FAQ com JSON-LD FAQPage (Fase 2.7).
 * Apenas renderiza quando há ao menos 2 perguntas.
 */
import { useMemo } from 'react';

export interface SeoFaqItem {
  question: string;
  answer: string;
}

interface SeoFaqBlockProps {
  items: SeoFaqItem[];
  title?: string;
}

export function SeoFaqBlock({ items, title = 'Perguntas frequentes' }: SeoFaqBlockProps) {
  const valid = useMemo(
    () => items.filter((i) => i.question?.trim() && i.answer?.trim()).slice(0, 10),
    [items],
  );

  const jsonLd = useMemo(() => {
    if (valid.length < 2) return null;
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: valid.map((i) => ({
        '@type': 'Question',
        name: i.question,
        acceptedAnswer: { '@type': 'Answer', text: i.answer },
      })),
    };
  }, [valid]);

  if (valid.length < 2) return null;

  return (
    <section aria-label={title} className="mt-10">
      <h2 className="mb-4 text-xl font-semibold text-foreground">{title}</h2>
      <dl className="space-y-4">
        {valid.map((i) => (
          <div key={i.question} className="rounded-lg border border-border bg-card p-4">
            <dt className="font-medium text-foreground">{i.question}</dt>
            <dd className="mt-1 text-sm text-muted-foreground">{i.answer}</dd>
          </div>
        ))}
      </dl>
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
    </section>
  );
}
