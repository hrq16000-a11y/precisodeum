/**
 * SeoFaqBlock — FAQ com JSON-LD FAQPage (Fase 2.7, expandido na Fase 2.8).
 * - Máximo 8 perguntas (era 10).
 * - Helper `buildLocalCategoryFaq` gera perguntas contextualizadas
 *   (preço, prazo, urgência, garantia, horário, dúvidas locais) sem
 *   duplicar texto massivo entre cidades.
 * - Bloqueia render em páginas thin (chame com `eligible={false}`).
 */
import { useMemo } from 'react';

export interface SeoFaqItem {
  question: string;
  answer: string;
}

interface SeoFaqBlockProps {
  items: SeoFaqItem[];
  title?: string;
  /** Quando false, não renderiza nem injeta JSON-LD. Default true. */
  eligible?: boolean;
}

export const MAX_FAQ_ITEMS = 8;

export function SeoFaqBlock({ items, title = 'Perguntas frequentes', eligible = true }: SeoFaqBlockProps) {
  const valid = useMemo(() => {
    if (!eligible) return [];
    const seen = new Set<string>();
    return items
      .filter((i) => i.question?.trim() && i.answer?.trim())
      .filter((i) => {
        const key = i.question.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, MAX_FAQ_ITEMS);
  }, [items, eligible]);

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
          // Escapa "<" para impedir que um "</script>" no conteúdo quebre o parsing HTML.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Helper Fase 2.8 — gera FAQ local contextualizada para landings city/category.
// Determinístico, sem IA, sem lorem ipsum.
// ---------------------------------------------------------------------------

export interface LocalCategoryFaqInput {
  categoryName: string;
  cityName?: string;
  /** Preço médio textual (ex.: "a partir de R$ 120"). */
  priceText?: string;
  /** Prazo típico (ex.: "1 a 3 dias úteis"). */
  etaText?: string;
  /** Texto sobre urgência. */
  urgencyText?: string;
  /** Texto sobre garantia. */
  warrantyText?: string;
  /** Horário de atendimento típico. */
  hoursText?: string;
  /** Permite suprimir FAQ se a página for thin. */
  eligible?: boolean;
}

export function buildLocalCategoryFaq(input: LocalCategoryFaqInput): SeoFaqItem[] {
  if (input.eligible === false) return [];
  const cat = (input.categoryName || 'profissional').toLowerCase();
  const inCity = input.cityName ? ` em ${input.cityName}` : '';
  const items: SeoFaqItem[] = [];

  items.push({
    question: `Quanto custa ${cat}${inCity}?`,
    answer:
      input.priceText ??
      `O valor de ${cat}${inCity} varia com escopo, urgência e materiais. Compare ao menos dois orçamentos por escopo fechado para evitar surpresas.`,
  });

  items.push({
    question: `Qual o prazo médio para ${cat}${inCity}?`,
    answer:
      input.etaText ??
      `Serviços pontuais costumam ser agendados em poucos dias úteis. Para trabalhos maiores, o prazo depende da disponibilidade do profissional e do volume da obra.`,
  });

  items.push({
    question: `Há atendimento emergencial de ${cat}${inCity}?`,
    answer:
      input.urgencyText ??
      `Sim. Vários profissionais oferecem atendimento de urgência. Priorize quem responde rápido no WhatsApp e atua próximo ao seu bairro.`,
  });

  items.push({
    question: `Existe garantia no serviço de ${cat}?`,
    answer:
      input.warrantyText ??
      `Sim, em geral. Combine por escrito o prazo de garantia, o que está coberto (mão de obra e/ou peças) e como funciona o retorno em caso de problema.`,
  });

  items.push({
    question: `Qual o horário de atendimento de ${cat}${inCity}?`,
    answer:
      input.hoursText ??
      `A maioria atende em horário comercial, com agendamentos extras à noite e fins de semana mediante combinação prévia.`,
  });

  if (input.cityName) {
    items.push({
      question: `O profissional atende todos os bairros de ${input.cityName}?`,
      answer: `Depende da área declarada por cada profissional. Confirme bairro e custo de deslocamento antes de fechar o orçamento.`,
    });
  }

  items.push({
    question: `Como avalio um bom profissional de ${cat}?`,
    answer:
      `Veja portfólio com fotos reais, avaliações de clientes, tempo de resposta no WhatsApp e clareza no orçamento. Prefira escopo fechado a preço por hora quando possível.`,
  });

  return items.slice(0, MAX_FAQ_ITEMS);
}
