/**
 * SeoRelatedLinks — bloco de internal linking para landings SEO (Fase 2.7).
 * Renderiza apenas blocos não-vazios, com limites do helper.
 *
 * Sprint A · Etapa 2: instrumenta cliques com `trackInternalLinkClick`
 * (fire-and-forget, sem await, sem bloquear navegação). Apenas links
 * renderizados aqui — não instrumentar navbar/footer/menu global.
 */
import { Link } from '@/lib/router-compat';
import type { SeoLink, SeoLinkBlock } from '@/lib/seoInternalLinking';
import {
  trackInternalLinkClick,
  type InternalLinkAnchorType,
} from '@/lib/publicFunnelTelemetry';

interface SeoRelatedLinksProps {
  blocks: SeoLinkBlock[];
  className?: string;
  /** Contexto opcional para enriquecer telemetria. */
  category?: string | null;
  city?: string | null;
}

const GROUP_TO_ANCHOR: Record<SeoLink['group'], InternalLinkAnchorType> = {
  city: 'related_city',
  category: 'related_category',
  service: 'related_category',
  neighborhood: 'neighborhood',
  urgency: 'urgency',
  provider: 'provider',
  trending: 'trending',
};

export function SeoRelatedLinks({ blocks, className, category, city }: SeoRelatedLinksProps) {
  if (!blocks.length) return null;
  return (
    <section
      aria-label="Conteúdos relacionados"
      className={className ?? 'mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3'}
    >
      {blocks.map((block) => (
        <nav
          key={block.title}
          aria-label={block.title}
          className="rounded-lg border border-border bg-card p-4"
        >
          <h3 className="mb-3 text-sm font-semibold text-foreground">{block.title}</h3>
          <ul className="space-y-1.5">
            {block.links.map((l, idx) => (
              <li key={l.href}>
                <Link
                  to={l.href}
                  onClick={() => {
                    try {
                      trackInternalLinkClick({
                        targetPath: l.href,
                        anchorType: GROUP_TO_ANCHOR[l.group] ?? 'other',
                        positionIndex: idx,
                        category: category ?? null,
                        city: city ?? null,
                      });
                    } catch {
                      /* fire-and-forget — nunca bloquear navegação */
                    }
                  }}
                  className="text-sm text-muted-foreground hover:text-primary hover:underline"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ))}
    </section>
  );
}
