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
import LazyImage from '@/components/ui/LazyImage';

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

  // Detecta se há ponto físico (qualquer dado de endereço institucional).
  const hasPhysicalLocation = Boolean(
    (p.street && p.street.trim()) ||
    (p.streetNumber && p.streetNumber.trim()) ||
    (p.postalCode && p.postalCode.trim()),
  );
  const showFull = p.showFullAddress === true;

  // Endereço público completo apenas com toggle ON; senão, bairro/cidade.
  const publicAddress = showFull
    ? [
        [p.street, p.streetNumber].filter(Boolean).join(', '),
        p.complement,
        p.neighborhood,
        [p.city, p.state].filter(Boolean).join(' - '),
        p.postalCode,
      ]
        .filter((s) => !!s && String(s).trim().length > 0)
        .join(' • ')
    : [p.neighborhood, [p.city, p.state].filter(Boolean).join(' - ')]
        .filter((s) => !!s && String(s).trim().length > 0)
        .join(' • ');

  const profileHref = `/empresa/${p.slug || p.id}`;

  return (
    <article
      ref={impressionRef as any}
      className="group relative flex h-full min-h-[248px] w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover"
      aria-label={`Empresa ${displayName}`}
    >
      {/* Body — layout compacto, avatar + texto (paridade com ProviderCard) */}
      <div className="relative flex min-w-0 flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-start gap-3 sm:gap-4">
          <Link
            to={profileHref}
            onClick={() => trackProfileClick(p.id, p.slug, trackingSource)}
            className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted ring-2 ring-transparent transition-transform duration-300 group-hover:scale-105 group-hover:ring-accent/20 sm:h-14 sm:w-14"
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
                <Building2 className="h-6 w-6 text-muted-foreground/60 sm:h-7 sm:w-7" aria-hidden="true" />
              </div>
            )}
          </Link>

          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="mb-1 flex items-center gap-1.5">
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
              className="block min-w-0 max-w-full"
            >
              <h3 className="font-display text-base font-bold text-foreground transition-colors group-hover:text-accent sm:text-lg line-clamp-2">
                {displayName}
              </h3>
            </Link>
            {p.businessSegment ? (
              <p className="mt-0.5 truncate text-[12px] font-medium text-muted-foreground">
                {p.businessSegment}
              </p>
            ) : p.category ? (
              <p className="mt-0.5 truncate text-[12px] font-medium text-accent">{p.category}</p>
            ) : null}
          </div>
        </div>

        {(p.rating > 0 || p.reviewCount > 0) && (
          <div className="mt-2 flex items-center gap-1.5 text-xs">
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
          <p className="mt-2 line-clamp-2 text-[13px] text-muted-foreground">{p.description}</p>
        )}

        <div className="mt-auto flex flex-wrap gap-2 pt-3">
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

      {/* Banda inferior — endereço (público ou parcial conforme privacidade). */}
      {publicAddress && (
        showFull ? (
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
            className="flex items-center gap-2 border-t border-border bg-muted/30 px-4 py-2 text-[12px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            aria-label={`Abrir endereço de ${displayName} no Google Maps`}
          >
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{publicAddress}</span>
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
          </a>
        ) : (
          <div
            className="flex items-center gap-2 border-t border-border bg-muted/30 px-4 py-2 text-[12px] text-muted-foreground"
            aria-label={`Localização aproximada de ${displayName}`}
          >
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">
              {hasPhysicalLocation ? `Atende em ${publicAddress}` : publicAddress}
            </span>
          </div>
        )
      )}
    </article>
  );
});

export default CompanyCard;
