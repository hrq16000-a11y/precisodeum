/**
 * SeoRelatedLinks — bloco de internal linking para landings SEO (Fase 2.7).
 * Renderiza apenas blocos não-vazios, com limites do helper.
 */
import { Link } from 'react-router-dom';
import type { SeoLinkBlock } from '@/lib/seoInternalLinking';

interface SeoRelatedLinksProps {
  blocks: SeoLinkBlock[];
  className?: string;
}

export function SeoRelatedLinks({ blocks, className }: SeoRelatedLinksProps) {
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
            {block.links.map((l) => (
              <li key={l.href}>
                <Link
                  to={l.href}
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
