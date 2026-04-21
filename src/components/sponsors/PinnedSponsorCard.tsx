import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { handleImageError, getOptimizedUrl } from '@/lib/imageResolver';
import { whatsappLink } from '@/lib/whatsapp';
import type { PinnedSponsor } from '@/hooks/usePinnedSponsor';

interface Props {
  sponsor: PinnedSponsor;
  onImpression: (id: string) => void;
  onClick: (id: string) => void;
}

/**
 * "Categoria Exclusiva" — pinned sponsor card shown above search results.
 * Premium look, identified as "Patrocinado" for transparency.
 */
const PinnedSponsorCard = ({ sponsor, onImpression, onClick }: Props) => {
  useEffect(() => {
    onImpression(sponsor.sponsor_id);
  }, [sponsor.sponsor_id, onImpression]);

  const cover = sponsor.image_url || sponsor.logo_url || '';
  const hasWhats = !!sponsor.whatsapp;
  const ctaHref = hasWhats
    ? whatsappLink(sponsor.whatsapp!, `Olá! Vi seu anúncio na plataforma Preciso de um.`)
    : sponsor.link_url || '#';

  const handleCta = () => onClick(sponsor.sponsor_id);

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="group relative mb-4 sm:mb-5 overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/5 via-card to-primary/5 shadow-card hover:shadow-card-hover transition-shadow"
    >
      {/* Pinned ribbon */}
      <div className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-accent/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-foreground shadow-md backdrop-blur">
        <Sparkles className="h-3 w-3" />
        Patrocinado
      </div>

      <div className="flex flex-col sm:flex-row">
        {/* Image */}
        {cover && (
          <div className="relative h-40 w-full shrink-0 overflow-hidden sm:h-auto sm:w-48 md:w-56">
            <img
              src={getOptimizedUrl(cover, 480) || cover}
              alt={sponsor.company_name || sponsor.title}
              loading="lazy"
              decoding="async"
              onError={handleImageError}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent sm:bg-gradient-to-r sm:from-transparent sm:to-card/40" />
          </div>
        )}

        {/* Content */}
        <div className="flex flex-1 flex-col justify-center p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">
            {sponsor.company_name || 'Anunciante'}
          </p>
          <h3 className="mt-0.5 font-display text-base font-bold leading-tight text-foreground sm:text-lg">
            {sponsor.title}
          </h3>
          {sponsor.short_description && (
            <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground sm:text-sm">
              {sponsor.short_description}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {hasWhats ? (
              <Button
                size="sm"
                className="h-9 gap-1.5 bg-[#25D366] text-white hover:bg-[#1da851] border-0"
                asChild
              >
                <a
                  href={ctaHref}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  onClick={handleCta}
                >
                  Falar no WhatsApp
                </a>
              </Button>
            ) : sponsor.link_url ? (
              <Button size="sm" className="h-9 gap-1.5" asChild>
                <a
                  href={ctaHref}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  onClick={handleCta}
                >
                  Saiba mais <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            ) : null}
            <span className="text-[10px] text-muted-foreground">
              Anúncio exibido por relevância para sua busca
            </span>
          </div>
        </div>
      </div>
    </motion.article>
  );
};

export default PinnedSponsorCard;
