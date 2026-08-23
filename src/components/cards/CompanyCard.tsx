import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Building2, MapPin, MessageCircle, Star, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { DbProvider } from '@/hooks/useProviders';
import { whatsappLink, buildSmartMessage } from '@/lib/whatsapp';
import { useGeoCity } from '@/hooks/useGeoCity';
import { useCardImpression } from '@/hooks/useCardImpression';
import { trackWhatsAppClick, trackProfileClick } from '@/lib/tracking';
import { resolveDisplayName } from '@/lib/providerDisplay';
import { capitalizeName } from '@/lib/normalize';
import LazyImage from '@/components/ui/LazyImage';

/**
 * CompanyCard — card empresarial (account_type='company').
 *
 * Layout COMPACTO equivalente ao ProviderCardFeatured/ProviderCard (mesmas
 * dimensões e padding), apenas com identidade visual diferente:
 *  - Logo retangular (rounded-lg, object-cover) em vez de avatar circular.
 *  - Badges "Empresa" / "Loja física".
 *  - Sem badges de gamificação (PJ não compete na meritocracia de PF).
 *
 * O endereço (quando público) aparece INLINE no corpo do card, não como
 * banda inferior — assim o card mantém o mesmo footprint dos demais.
 */
interface CompanyCardProps {
  provider: DbProvider;
  trackingSource?: string;
}

const CompanyCard = memo(function CompanyCard({
  provider: p,
  trackingSource = 'search',
}: CompanyCardProps) {
  const impressionRef = useCardImpression(p.id, p.slug, trackingSource);
  const { city: geoCity, state: geoState } = useGeoCity();

  const displayName = capitalizeName(
    resolveDisplayName({
      providerName: p.name,
      businessName: p.businessName,
      legalName: p.legalName,
      slug: p.slug,
      city: p.city,
      accountType: 'company',
    }),
  );

  const logoSrc = (p.photo || '').trim();

  const hasPhysicalLocation = Boolean(
    (p.street && p.street.trim()) ||
    (p.streetNumber && p.streetNumber.trim()) ||
    (p.postalCode && p.postalCode.trim()),
  );

  const profileHref = `/empresa/${p.slug || p.id}`;
  const cityState = [p.city, p.state].filter(Boolean).join(' - ');

  const rating = p.rating ?? 0;
  const reviewCount = p.reviewCount ?? 0;

  return (
    <article
      ref={impressionRef as any}
      className="group relative flex h-full w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
      aria-label={`Empresa ${displayName}`}
    >
      {/* Accent bar — paridade com ProviderCardFeatured */}
      <div className="h-1 shrink-0 bg-gradient-to-r from-accent via-amber-400 to-accent" />

      <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
        <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
          <Link
            to={profileHref}
            onClick={() => trackProfileClick(p.id, p.slug, trackingSource)}
            className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted ring-2 ring-accent/20 transition-transform duration-300 group-hover:scale-105 sm:h-16 sm:w-16"
            aria-label={`Ver empresa ${displayName}`}
          >
            {logoSrc ? (
              <LazyImage
                src={logoSrc}
                alt={`Logo ${displayName}`}
                priority
                sizesPreset="avatar"
                surface="company-card"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                <Building2 className="h-5 w-5 text-muted-foreground/60 sm:h-6 sm:w-6" aria-hidden="true" />
              </div>
            )}
          </Link>

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-1">
              <Badge
                variant="secondary"
                className="inline-flex h-5 items-center gap-1 px-1.5 py-0 text-[10px] font-semibold"
              >
                <Building2 className="h-3 w-3" aria-hidden="true" />
                Empresa
              </Badge>
              {hasPhysicalLocation && (
                <Badge
                  variant="outline"
                  className="inline-flex h-5 items-center gap-1 border-amber-500/40 px-1.5 py-0 text-[10px] font-semibold text-amber-700 dark:text-amber-300"
                >
                  <Store className="h-3 w-3" aria-hidden="true" />
                  Loja física
                </Badge>
              )}
            </div>

            <Link
              to={profileHref}
              onClick={() => trackProfileClick(p.id, p.slug, trackingSource)}
              className="block min-w-0"
            >
              <h3
                className="font-display text-[15px] font-bold text-foreground transition-colors group-hover:text-accent sm:text-base"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  wordBreak: 'break-word',
                }}
              >
                {displayName}
              </h3>
            </Link>

            {p.businessSegment ? (
              <p className="truncate text-[13px] font-medium text-accent sm:text-sm">
                {p.businessSegment}
              </p>
            ) : p.category ? (
              <p className="truncate text-[13px] font-medium text-accent sm:text-sm">{p.category}</p>
            ) : null}

            {cityState && (
              <div className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground sm:text-xs">
                <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{cityState}</span>
              </div>
            )}
          </div>
        </div>

        {(rating > 0 || reviewCount > 0) && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-3.5 w-3.5 ${star <= Math.round(rating) ? 'fill-accent text-accent' : 'text-muted-foreground/20'}`}
                  aria-hidden="true"
                />
              ))}
            </div>
            <span className="text-xs font-bold text-foreground">
              {rating > 0 ? rating.toFixed(1) : '—'}
            </span>
            {reviewCount > 0 && (
              <span className="text-[11px] text-muted-foreground">({reviewCount})</span>
            )}
          </div>
        )}

        <div className="mt-2.5 flex w-full min-w-0 flex-wrap items-stretch gap-2">
          {p.whatsapp && (
            <Button
              variant="accent"
              size="sm"
              className="h-9 min-w-0 flex-1 basis-[120px] px-2 text-xs transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] sm:h-10 sm:text-sm"
              asChild
            >
              <a
                href={whatsappLink(
                  p.whatsapp,
                  buildSmartMessage(displayName, p.businessSegment || p.category, geoCity, geoState),
                )}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsAppClick(p.id, p.slug, trackingSource)}
                className="inline-flex w-full min-w-0 items-center justify-center gap-1"
                aria-label={`Falar com ${displayName} no WhatsApp`}
              >
                <MessageCircle className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden="true" />
                <span className="truncate">WhatsApp</span>
              </a>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-9 min-w-0 flex-1 basis-[100px] px-2 text-xs transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] sm:h-10 sm:text-sm"
            asChild
          >
            <Link
              to={profileHref}
              onClick={() => trackProfileClick(p.id, p.slug, trackingSource)}
              className="inline-flex w-full min-w-0 items-center justify-center"
            >
              <span className="truncate">Ver empresa</span>
            </Link>
          </Button>
        </div>
        <p className="mt-1 text-center text-[10px] text-muted-foreground">
          Negociação direta e transparente
        </p>
      </div>
    </article>
  );
});

export default CompanyCard;
