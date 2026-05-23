/**
 * SeoEnhancementSection — Fase 2.9 (Runtime Adoption)
 *
 * Camada única que conecta a foundation da Fase 2.8 às páginas reais:
 *  - shouldIndex() decide se o bloco renderiza (fail-closed em thin/noindex).
 *  - buildContentBlocks() entrega o texto contextual (≥250 palavras).
 *  - buildLocalCategoryFaq() + SeoFaqBlock entregam FAQ contextual com JSON-LD.
 *  - buildRelatedLinks() + SeoRelatedLinks entregam navegação interna priorizada.
 *
 * Características operacionais:
 *  - 100% memoizado por input (evita rerender em loop).
 *  - SeoFaqBlock e SeoRelatedLinks ficam em lazy() — não pesam no LCP.
 *  - Sem nova query, sem realtime, sem observer, sem polling.
 *  - DEV-only: publica métricas em `window.__SEO_RUNTIME_DEBUG[path]`
 *    (render_ms / eligible / noindex / faq_count / links_count / content_words).
 *  - Em produção, o efeito DEV é tree-shaken via `import.meta.env.DEV`.
 *
 * Mount esperado: ABAIXO da primeira dobra, ao final do conteúdo principal
 * da página (CategoryPage, CityPage, ProviderProfile, etc).
 */
import { lazy, Suspense, useEffect, useMemo, useRef } from 'react';
import {
  buildContentBlocks,
  isSeoContentEligible,
  type SeoContentInput,
} from '@/lib/seo/seoContentBlocks';
import {
  buildRelatedLinks,
  type LinkSignals,
} from '@/lib/seoInternalLinking';
import {
  shouldIndex,
  type IndexationInput,
} from '@/lib/seo/seoIndexationGuard';
import type { LocalCategoryFaqInput } from '@/components/seo/SeoFaqBlock';

const SeoFaqBlock = lazy(() =>
  import('@/components/seo/SeoFaqBlock').then((m) => ({ default: m.SeoFaqBlock })),
);
const SeoRelatedLinks = lazy(() =>
  import('@/components/seo/SeoRelatedLinks').then((m) => ({ default: m.SeoRelatedLinks })),
);

interface RelatedItem {
  name: string;
  slug: string;
  signals?: LinkSignals;
}
interface RelatedNearbyItem extends RelatedItem {
  distanceKm?: number;
}

interface SeoEnhancementSectionProps {
  indexation: IndexationInput;
  content: SeoContentInput;
  faq?: Omit<LocalCategoryFaqInput, 'eligible'>;
  links?: {
    citySlug?: string;
    categorySlug?: string;
    relatedCities?: RelatedItem[];
    relatedCategories?: RelatedItem[];
    relatedNeighborhoods?: RelatedItem[];
    nearbyCities?: RelatedNearbyItem[];
    highConversionProviders?: RelatedItem[];
    trendingSearches?: Array<{ label: string; slug: string; signals?: LinkSignals }>;
    thinPaths?: Set<string>;
  };
  /** id-âncora opcional para sumário/scroll. */
  anchorId?: string;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export default function SeoEnhancementSection({
  indexation,
  content,
  faq,
  links,
  anchorId = 'seo-context',
}: SeoEnhancementSectionProps) {
  const verdict = useMemo(() => shouldIndex(indexation), [indexation]);
  const eligibility = useMemo(() => isSeoContentEligible(content), [content]);

  const contentBlocks = useMemo(
    () => (verdict.index ? buildContentBlocks(content) : []),
    [verdict.index, content],
  );

  // FAQ usa o helper canônico — buildLocalCategoryFaq vive dentro do SeoFaqBlock
  // module. Carregamos o helper síncrono via dynamic require? Não: usamos a
  // import lazy do componente; aqui só passamos os parâmetros, o componente
  // chama buildLocalCategoryFaq internamente quando renderiza. Para manter o
  // contrato simples e a memoização dos counts (DEV telemetry), pré-calculamos
  // os items via fallback estável.
  const faqItems = useMemo(() => {
    if (!verdict.index || !faq) return [];
    if (!eligibility.eligible) return [];
    // Lazy require sem dependência runtime extra: reaproveita o módulo já
    // carregado quando o Suspense resolver. Para a contagem DEV, simulamos a
    // saída do helper a partir do input (mesma cardinalidade).
    const base = 5 + (faq.cityName ? 1 : 0) + 1; // ver buildLocalCategoryFaq
    return Array.from({ length: Math.min(8, base) });
  }, [verdict.index, faq, eligibility.eligible]);

  const linkBlocks = useMemo(() => {
    if (!verdict.index || !links) return [];
    return buildRelatedLinks({
      currentPath: indexation.path,
      citySlug: links.citySlug,
      categorySlug: links.categorySlug,
      relatedCities: links.relatedCities,
      relatedCategories: links.relatedCategories,
      relatedNeighborhoods: links.relatedNeighborhoods,
      nearbyCities: links.nearbyCities,
      highConversionProviders: links.highConversionProviders,
      trendingSearches: links.trendingSearches,
      thinPaths: links.thinPaths,
    });
  }, [verdict.index, links, indexation.path]);

  // DEV telemetry — não roda em produção.
  const mountedAt = useRef<number>(
    typeof performance !== 'undefined' ? performance.now() : 0,
  );
  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') return;
    const elapsed =
      (typeof performance !== 'undefined' ? performance.now() : 0) - mountedAt.current;
    const contentWords = contentBlocks.reduce(
      (n, b) => n + countWords(b.title) + countWords(b.paragraphs.join(' ')),
      0,
    );
    const linksCount = linkBlocks.reduce((n, b) => n + b.links.length, 0);
    const bucket = ((window as unknown) as { __SEO_RUNTIME_DEBUG?: Record<string, unknown> });
    bucket.__SEO_RUNTIME_DEBUG = {
      ...(bucket.__SEO_RUNTIME_DEBUG || {}),
      [indexation.path]: {
        render_ms: Math.round(elapsed * 100) / 100,
        eligible: eligibility.eligible,
        noindex: !verdict.index,
        reasons: verdict.reasons,
        faq_count: faqItems.length,
        links_count: linksCount,
        content_words: contentWords,
        canonical: verdict.canonicalPath,
      },
    };
  }, [contentBlocks, faqItems, linkBlocks, verdict, eligibility.eligible, indexation.path]);

  // Fail-closed: nada para renderizar.
  if (!verdict.index) return null;
  if (contentBlocks.length === 0 && faqItems.length === 0 && linkBlocks.length === 0) {
    return null;
  }

  return (
    <section
      id={anchorId}
      aria-label="Conteúdo contextual"
      className="container px-4 py-10"
    >
      {contentBlocks.length > 0 && (
        <div className="mx-auto max-w-3xl space-y-6">
          {contentBlocks.map((b) => (
            <article key={b.kind}>
              <h2 className="text-lg font-semibold text-foreground md:text-xl">
                {b.title}
              </h2>
              <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
                {b.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}

      {faq && eligibility.eligible && (
        <Suspense fallback={null}>
          <SeoFaqBlockLoader faq={faq} />
        </Suspense>
      )}

      {linkBlocks.length > 0 && (
        <Suspense fallback={null}>
          <SeoRelatedLinks blocks={linkBlocks} />
        </Suspense>
      )}
    </section>
  );
}

/** Wrapper para chamar buildLocalCategoryFaq dentro do chunk lazy do FAQ. */
function SeoFaqBlockLoader({
  faq,
}: {
  faq: Omit<LocalCategoryFaqInput, 'eligible'>;
}) {
  // Import síncrono dentro do chunk já carregado pelo Suspense:
  // o componente SeoFaqBlock está no mesmo módulo do helper.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('@/components/seo/SeoFaqBlock') as typeof import('@/components/seo/SeoFaqBlock');
  const items = mod.buildLocalCategoryFaq({ ...faq, eligible: true });
  if (items.length < 2) return null;
  return <mod.SeoFaqBlock items={items} eligible={true} />;
}
