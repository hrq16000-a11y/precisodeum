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
import {
  buildLocalCategoryFaq,
  type LocalCategoryFaqInput,
  type SeoFaqItem,
} from '@/components/seo/SeoFaqBlock';

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

  const faqItems: SeoFaqItem[] = useMemo(() => {
    if (!verdict.index || !faq || !eligibility.eligible) return [];
    return buildLocalCategoryFaq({ ...faq, eligible: true });
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

  // DEV telemetry — em produção é tree-shaken.
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
    const bucket = window as unknown as {
      __SEO_RUNTIME_DEBUG?: Record<string, unknown>;
    };
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

  // Fail-closed.
  if (!verdict.index) return null;
  if (
    contentBlocks.length === 0 &&
    faqItems.length === 0 &&
    linkBlocks.length === 0
  ) {
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

      {faqItems.length >= 2 && (
        <Suspense fallback={null}>
          <div className="mx-auto max-w-3xl">
            <SeoFaqBlock items={faqItems} eligible={true} />
          </div>
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
