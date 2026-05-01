import { useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, MapPin, Phone, MessageCircle, Globe, Instagram, Facebook, ExternalLink, Calendar, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { whatsappLink, buildSmartMessage } from '@/lib/whatsapp';
import { useGeoCity } from '@/hooks/useGeoCity';
import { useJsonLd } from '@/hooks/useJsonLd';
import { trackWhatsAppClick, trackProfileClick } from '@/lib/tracking';
import { capitalizeName } from '@/lib/normalize';

/**
 * CompanyProfile — página institucional para perfis PJ (/empresa/:slug).
 *
 * Layout corporativo distinto do ProviderProfile (PF):
 * - Hero com galeria de fotos da empresa (até 9 itens, grid 3x3 responsivo).
 * - Seção "Sobre a Empresa".
 * - Bloco "Endereço e Localização" com Google Maps embed.
 * - Lista de serviços/segmentos atendidos.
 *
 * SEO: JSON-LD `LocalBusiness` (não Person), via useJsonLd.
 *
 * Mantém os mesmos eventos de telemetria (trackWhatsAppClick / trackProfileClick).
 * Não altera ProviderProfile.tsx.
 */

interface CompanyRow {
  id: string;
  user_id: string;
  slug: string;
  business_name: string | null;
  legal_name?: string | null;
  description: string | null;
  photo_url: string | null;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  phone: string | null;
  whatsapp: string | null;
  latitude: number | null;
  longitude: number | null;
  rating_avg: number | null;
  review_count: number | null;
  account_type: string | null;
  business_segment: string | null;
  street: string | null;
  street_number: string | null;
  complement: string | null;
  postal_code: string | null;
  show_full_address?: boolean | null;
  social_links: Record<string, string> | null;
  founded_year?: number | null;
  team_size?: number | null;
}

const buildMapsHref = (parts: (string | null | undefined)[]): string => {
  const q = parts.filter((p) => !!p && String(p).trim().length > 0).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
};

const buildMapsEmbed = (parts: (string | null | undefined)[]): string => {
  const q = parts.filter((p) => !!p && String(p).trim().length > 0).join(', ');
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
};

export default function CompanyProfile() {
  const { slug } = useParams<{ slug: string }>();
  const { city: geoCity, state: geoState } = useGeoCity();

  const { data: company, isLoading, error } = useQuery({
    queryKey: ['company-profile', slug],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('providers')
        .select(
          'id, user_id, slug, business_name, legal_name, description, photo_url, city, state, neighborhood, phone, whatsapp, latitude, longitude, rating_avg, review_count, account_type, business_segment, street, street_number, complement, postal_code, show_full_address, social_links, founded_year, team_size',
        )
        .eq('slug', slug || '')
        .eq('status', 'approved')
        .is('deleted_at', null)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown) as CompanyRow | null;
    },
    enabled: !!slug,
    staleTime: 1000 * 60 * 2,
  });

  // Galeria — primeiras 9 fotos do portfólio (se houver). Falha silenciosa.
  const { data: gallery } = useQuery({
    queryKey: ['company-gallery', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];
      const { data, error } = await (supabase as any)
        .from('media')
        .select('url, optimized_url, alt_text')
        .eq('owner_provider_id', company.id)
        .eq('kind', 'portfolio')
        .order('created_at', { ascending: false })
        .limit(9);
      if (error) return [];
      return ((data as unknown) as Array<{ url: string; optimized_url: string | null; alt_text: string | null }>) || [];
    },
    enabled: !!company?.id,
    staleTime: 1000 * 60 * 5,
  });

  const displayName = capitalizeName(
    company?.business_name?.trim() ||
      company?.legal_name?.trim() ||
      (company?.city ? `Empresa em ${company.city}` : 'Empresa'),
  );

  const showFull = company?.show_full_address === true;
  const fullAddress = useMemo(() => {
    if (!company) return '';
    if (!showFull) {
      return [company.neighborhood, [company.city, company.state].filter(Boolean).join(' - ')]
        .filter((s) => !!s && String(s).trim().length > 0)
        .join(' • ');
    }
    return [
      [company.street, company.street_number].filter(Boolean).join(', '),
      company.complement,
      company.neighborhood,
      [company.city, company.state].filter(Boolean).join(' - '),
      company.postal_code,
    ]
      .filter((s) => !!s && String(s).trim().length > 0)
      .join(' • ');
  }, [company, showFull]);

  // SEO: JSON-LD LocalBusiness
  const jsonLd = useMemo(() => {
    if (!company) return null;
    return {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: displayName,
      legalName: company.legal_name || undefined,
      description: company.description || undefined,
      image: company.photo_url || undefined,
      url: typeof window !== 'undefined' ? `${window.location.origin}/empresa/${company.slug}` : undefined,
      telephone: company.phone || company.whatsapp || undefined,
      address: {
        '@type': 'PostalAddress',
        streetAddress: showFull ? ([company.street, company.street_number].filter(Boolean).join(', ') || undefined) : undefined,
        addressLocality: company.city || undefined,
        addressRegion: company.state || undefined,
        postalCode: showFull ? (company.postal_code || undefined) : undefined,
        addressCountry: 'BR',
      },
      geo:
        company.latitude && company.longitude
          ? {
              '@type': 'GeoCoordinates',
              latitude: company.latitude,
              longitude: company.longitude,
            }
          : undefined,
      aggregateRating:
        company.review_count && company.review_count > 0
          ? {
              '@type': 'AggregateRating',
              ratingValue: company.rating_avg || 0,
              reviewCount: company.review_count,
            }
          : undefined,
      sameAs: company.social_links
        ? Object.values(company.social_links).filter((v) => typeof v === 'string' && v.startsWith('http'))
        : undefined,
    };
  }, [company, displayName]);

  useJsonLd(jsonLd, `company-${company?.id || slug}`);

  useEffect(() => {
    if (company) trackProfileClick(company.id, company.slug, 'company-profile');
  }, [company]);

  if (isLoading) {
    return (
      <>
        <Header />
        <main className="container py-12">
          <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
          <div className="mt-4 h-64 animate-pulse rounded-2xl bg-muted" />
        </main>
        <Footer />
      </>
    );
  }

  if (error || !company) {
    return (
      <>
        <Header />
        <main className="container py-16 text-center">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-bold">Empresa não encontrada</h1>
          <p className="mt-2 text-muted-foreground">
            Verifique o link ou volte para a busca.
          </p>
          <Button asChild className="mt-6">
            <Link to="/buscar">Voltar para busca</Link>
          </Button>
        </main>
        <Footer />
      </>
    );
  }

  const isCompany = (company.account_type || '').toLowerCase() === 'company';

  return (
    <>
      <Header />
      <main className="bg-background">
        {/* Hero */}
        <section className="relative bg-gradient-to-br from-muted/40 to-background py-8 md:py-12">
          <div className="container">
            <div className="flex flex-col gap-6 md:flex-row md:items-end">
              <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-card shadow-md md:h-40 md:w-40">
                {company.photo_url ? (
                  <img
                    src={company.photo_url}
                    alt={`Logo ${displayName}`}
                    fetchPriority="high"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Building2 className="h-16 w-16 text-muted-foreground/40" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Badge variant="secondary" className="inline-flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {isCompany ? 'Empresa / Unidade Física' : 'Perfil profissional'}
                </Badge>
                <h1 className="mt-2 font-display text-3xl font-bold text-foreground md:text-4xl">
                  {displayName}
                </h1>
                {company.business_segment && (
                  <p className="mt-1 text-muted-foreground">{company.business_segment}</p>
                )}
                {(company.rating_avg || 0) > 0 && (
                  <div className="mt-2 flex items-center gap-1.5 text-sm">
                    <Star className="h-4 w-4 fill-accent text-accent" aria-hidden="true" />
                    <span className="font-bold">{Number(company.rating_avg).toFixed(1)}</span>
                    {company.review_count ? (
                      <span className="text-muted-foreground">
                        ({company.review_count} avaliações)
                      </span>
                    ) : null}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {company.whatsapp && (
                    <Button variant="accent" asChild>
                      <a
                        href={whatsappLink(
                          company.whatsapp,
                          buildSmartMessage(displayName, company.business_segment, geoCity, geoState),
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => trackWhatsAppClick(company.id, company.slug, 'company-profile')}
                      >
                        <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                        WhatsApp
                      </a>
                    </Button>
                  )}
                  {company.phone && (
                    <Button variant="outline" asChild>
                      <a href={`tel:${company.phone}`}>
                        <Phone className="mr-2 h-4 w-4" aria-hidden="true" />
                        {company.phone}
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Galeria */}
        {gallery && gallery.length > 0 && (
          <section className="border-t border-border bg-card/50 py-8">
            <div className="container">
              <h2 className="mb-4 font-display text-xl font-bold">Fotos da empresa</h2>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {gallery.map((img, i) => (
                  <a
                    key={i}
                    href={img.optimized_url || img.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative block aspect-square overflow-hidden rounded-lg bg-muted"
                  >
                    <img
                      src={img.optimized_url || img.url}
                      alt={img.alt_text || `Foto ${i + 1} de ${displayName}`}
                      // First image of company gallery → priority hint for LCP
                      fetchPriority={i === 0 ? 'high' : 'auto'}
                      loading={i === 0 ? 'eager' : 'lazy'}
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </a>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Sobre */}
        {company.description && (
          <section className="py-8">
            <div className="container max-w-3xl">
              <h2 className="mb-3 font-display text-xl font-bold">Sobre a empresa</h2>
              <p className="whitespace-pre-line text-foreground/90">{company.description}</p>
              {(company.founded_year || company.team_size) && (
                <dl className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {company.founded_year && (
                    <div className="inline-flex items-center gap-1">
                      <Calendar className="h-4 w-4" aria-hidden="true" />
                      <dt className="sr-only">Fundada em</dt>
                      <dd>Fundada em {company.founded_year}</dd>
                    </div>
                  )}
                  {company.team_size && (
                    <div>
                      <dt className="sr-only">Tamanho da equipe</dt>
                      <dd>{company.team_size} colaboradores</dd>
                    </div>
                  )}
                </dl>
              )}
            </div>
          </section>
        )}

        {/* Endereço e localização */}
        {fullAddress && (
          <section className="border-t border-border bg-muted/20 py-8">
            <div className="container max-w-4xl">
              <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold">
                <MapPin className="h-5 w-5 text-accent" aria-hidden="true" />
                {showFull ? 'Contato e endereço' : 'Ponto de atendimento físico'}
              </h2>
              {showFull ? (
                <a
                  href={buildMapsHref([
                    company.street,
                    company.street_number,
                    company.neighborhood,
                    company.city,
                    company.state,
                    company.postal_code,
                  ])}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-foreground hover:text-accent"
                >
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  <span>{fullAddress}</span>
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              ) : (
                <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  <span>Atende em {fullAddress}</span>
                </p>
              )}
              {showFull && (
                <div className="mt-4 overflow-hidden rounded-xl border border-border">
                  <iframe
                    title={`Mapa da empresa ${displayName}`}
                    src={buildMapsEmbed([
                      company.street,
                      company.street_number,
                      company.city,
                      company.state,
                      company.postal_code,
                    ])}
                    className="h-72 w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              )}
            </div>
          </section>
        )}

        {/* Redes sociais */}
        {company.social_links && Object.keys(company.social_links).length > 0 && (
          <section className="py-8">
            <div className="container max-w-4xl">
              <h2 className="mb-3 font-display text-xl font-bold">Onde nos encontrar</h2>
              <div className="flex flex-wrap gap-2">
                {company.social_links.website && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={company.social_links.website} target="_blank" rel="noopener noreferrer">
                      <Globe className="mr-2 h-4 w-4" aria-hidden="true" /> Site
                    </a>
                  </Button>
                )}
                {company.social_links.instagram && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={company.social_links.instagram} target="_blank" rel="noopener noreferrer">
                      <Instagram className="mr-2 h-4 w-4" aria-hidden="true" /> Instagram
                    </a>
                  </Button>
                )}
                {company.social_links.facebook && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={company.social_links.facebook} target="_blank" rel="noopener noreferrer">
                      <Facebook className="mr-2 h-4 w-4" aria-hidden="true" /> Facebook
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
