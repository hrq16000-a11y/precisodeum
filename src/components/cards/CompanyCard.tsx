import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Building2, MapPin, MessageCircle, ExternalLink, Star, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { DbProvider } from '@/hooks/useProviders';
import { whatsappLink, buildSmartMessage } from '@/lib/whatsapp';
import { useGeoCity } from '@/hooks/useGeoCity';
import { useCardImpression } from '@/hooks/useCardImpression';
import { trackWhatsAppClick, trackProfileClick } from '@/lib/tracking';
import { resolveDisplayName } from '@/lib/providerDisplay';
import { capitalizeName } from '@/lib/normalize';

/**
 * CompanyCard — card específico para perfis empresariais (account_type='company').
 *
 * Diferenças vs. ProviderCard:
 * - Logo retangular (object-cover) em vez de avatar circular.
 * - Banda inferior com endereço completo clicável → abre Google Maps.
 * - Badge "Empresa / Unidade Física" (lucide Building2).
 * - Layout institucional, sem badges de gamificação/níveis (PJ não compete na
 *   meritocracia de profissionais autônomos — RESTRIÇÃO CRÍTICA).
 *
 * Reusa hooks de telemetria (useCardImpression, trackWhatsAppClick,
 * trackProfileClick) para preservar o funil de conversão.
 */
interface CompanyCardProps {
  provider: DbProvider;
  trackingSource?: string;
}

const buildMapsHref = (parts: (string | null | undefined)[]): string => {
  const q = parts.filter((p) => !!p && String(p).trim().length > 0).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
};

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
  const fullAddress = [
    [p.street, p.streetNumber].filter(Boolean).join(', '),
    p.complement,
    p.neighborhood,
    [p.city, p.state].filter(Boolean).join(' - '),
    p.postalCode,
  ]
    .filter((s) => !!s && String(s).trim().length > 0)
    .join(' • ');

  const profileHref = `/empresa/${p.slug || p.id}`;

  return (
    <article
      ref={impressionRef as any}
      className="group relative flex h-full w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
      aria-label={`Empresa ${displayName}`}
    >
      {/* Header — logo retangular */}
      <Link
        to={profileHref}
        onClick={() => trackProfileClick(p.id, p.slug, trackingSource)}
        className="relative block aspect-[16/9] w-full overflow-hidden bg-muted"
      >
        {logoSrc ? (
          <img
            src={logoSrc}
            alt={`Logo ${displayName}`}
            // First image of a company gallery → priority hint for LCP
            fetchPriority="high"
            loading="eager"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <Building2 className="h-14 w-14 text-muted-foreground/40" aria-hidden="true" />
          </div>
        )}
        <Badge
          variant="secondary"
          className="absolute left-3 top-3 inline-flex items-center gap-1 bg-background/90 text-foreground shadow-sm backdrop-blur"
        >
          <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
          Empresa
        </Badge>
      </Link>

      {/* Body */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <div className="min-w-0">
          <Link
            to={profileHref}
            onClick={() => trackProfileClick(p.id, p.slug, trackingSource)}
            className="block"
          >
            <h3 className="font-display text-base font-bold text-foreground transition-colors group-hover:text-accent sm:text-lg line-clamp-2">
              {displayName}
            </h3>
          </Link>
          {p.businessSegment && (
            <p className="mt-0.5 truncate text-[12px] font-medium text-muted-foreground">
              {p.businessSegment}
            </p>
          )}
          {p.category && !p.businessSegment && (
            <p className="mt-0.5 truncate text-[12px] font-medium text-accent">{p.category}</p>
          )}
        </div>

        {(p.rating > 0 || p.reviewCount > 0) && (
          <div className="flex items-center gap-1.5 text-xs">
            <Star className="h-3.5 w-3.5 fill-accent text-accent" aria-hidden="true" />
            <span className="font-bold text-foreground">
              {p.rating > 0 ? p.rating.toFixed(1) : '—'}
            </span>
            {p.reviewCount > 0 && (
              <span className="text-muted-foreground">({p.reviewCount} avaliações)</span>
            )}
          </div>
        )}

        {p.description && (
          <p className="line-clamp-2 text-[13px] text-muted-foreground">{p.description}</p>
        )}

        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          {p.whatsapp && (
            <Button variant="accent" size="sm" className="h-9 flex-1 text-xs" asChild>
              <a
                href={whatsappLink(
                  p.whatsapp,
                  buildSmartMessage(displayName, p.businessSegment || p.category, geoCity, geoState),
                )}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsAppClick(p.id, p.slug, trackingSource)}
                aria-label={`Falar com ${displayName} no WhatsApp`}
              >
                <MessageCircle className="mr-1 h-4 w-4" aria-hidden="true" />
                WhatsApp
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-9 flex-1 text-xs" asChild>
            <Link
              to={profileHref}
              onClick={() => trackProfileClick(p.id, p.slug, trackingSource)}
            >
              Ver empresa
            </Link>
          </Button>
        </div>
      </div>

      {/* Banda inferior — endereço institucional (Maps) */}
      {fullAddress && (
        <a
          href={buildMapsHref([
            p.street,
            p.streetNumber,
            p.neighborhood,
            p.city,
            p.state,
            p.postalCode,
          ])}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 border-t border-border bg-muted/30 px-4 py-2.5 text-[12px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          aria-label={`Abrir endereço de ${displayName} no Google Maps`}
        >
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{fullAddress}</span>
          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
        </a>
      )}
    </article>
  );
});

export default CompanyCard;
