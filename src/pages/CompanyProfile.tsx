import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, MapPin, MessageCircle, Globe, Instagram, Facebook, ExternalLink, Star, Send, ChevronRight, Image as ImageIcon, Briefcase, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { whatsappLink, toCanonical } from '@/lib/whatsapp';
import { useGeoCity } from '@/hooks/useGeoCity';
import { useJsonLd } from '@/hooks/useJsonLd';
import { trackWhatsAppClick, trackProfileClick } from '@/lib/tracking';
import { capitalizeName } from '@/lib/normalize';
import { useWhatsAppGate } from '@/contexts/WhatsAppGateContext';
import { ContactWindowPicker } from '@/components/leads/ContactWindowPicker';
import { normalizeContactHours, type PreferredWindow } from '@/lib/contactWindow';
import { toast } from 'sonner';
import { formatCityState } from '@/lib/locationFormat';
import { sanitizeSlug } from '@/lib/slugify';

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
  working_hours_struct?: Record<string, unknown> | null;
  contact_hours?: Record<string, unknown> | null;
  website?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
}

interface CompanyService {
  id: string;
  name?: string | null;
  service_name?: string | null;
  description?: string | null;
  service_area?: string | null;
  price?: number | null;
  price_min?: number | null;
  price_max?: number | null;
  serviceCategories?: Array<{ name?: string | null; icon?: string | null }>;
}

interface LeadFormState {
  name: string;
  phone: string;
  service: string;
  message: string;
  city: string;
  state: string;
}

const COMPANY_PUBLIC_COLS = [
  'id',
  'user_id',
  'slug',
  'business_name',
  'legal_name',
  'description',
  'photo_url',
  'city',
  'state',
  'neighborhood',
  'phone',
  'whatsapp',
  'latitude',
  'longitude',
  'rating_avg',
  'review_count',
  'account_type',
  'business_segment',
  'street',
  'street_number',
  'complement',
  'postal_code',
  'show_full_address',
  'social_links',
  'working_hours_struct',
  'contact_hours',
  'website',
  'meta_title',
  'meta_description',
].join(', ');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const getLeadSource = () => {
  if (typeof window === 'undefined') return 'direto';
  const params = new URLSearchParams(window.location.search);
  const source = (params.get('origem') || params.get('utm_source') || '').toLowerCase();
  if (source.includes('busca') || document.referrer.includes('/buscar')) return 'busca';
  if (source.includes('categoria') || document.referrer.includes('/categoria/')) return 'categoria';
  return 'direto';
};

const truncateAt = (text: string, max: number) => {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice).replace(/[\s,.;:-]+$/, '') + '…';
};

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
  const navigate = useNavigate();
  useGeoCity();
  const { requestWhatsApp } = useWhatsAppGate();
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [leadSent, setLeadSent] = useState(false);
  const [preferredWindow, setPreferredWindow] = useState<PreferredWindow | null>(null);
  const [leadForm, setLeadForm] = useState<LeadFormState>({
    name: '',
    phone: '',
    service: '',
    message: '',
    city: '',
    state: '',
  });

  const { data: company, isLoading, error } = useQuery({
    queryKey: ['company-profile', slug],
    queryFn: async () => {
      const param = (slug || '').trim();
      let { data, error } = await (supabase as any)
        .from('providers')
        .select(COMPANY_PUBLIC_COLS)
        .eq('slug', param)
        .eq('status', 'approved')
        .is('deleted_at', null)
        .maybeSingle();
      if (error) throw error;

      const sanitized = sanitizeSlug(param);
      if (!data && sanitized && sanitized !== param) {
        const { data: bySanitized, error: bySanitizedError } = await (supabase as any)
          .from('providers')
          .select(COMPANY_PUBLIC_COLS)
          .eq('slug', sanitized)
          .eq('status', 'approved')
          .is('deleted_at', null)
          .maybeSingle();
        if (bySanitizedError) throw bySanitizedError;
        data = bySanitized;
      }

      const isUuid = UUID_RE.test(param);
      if (!data && isUuid) {
        const { data: byId, error: errById } = await (supabase as any)
          .from('providers')
          .select(COMPANY_PUBLIC_COLS)
          .eq('id', param)
          .eq('status', 'approved')
          .is('deleted_at', null)
          .maybeSingle();
        if (errById) throw errById;
        data = byId;
      }
      return (data as unknown) as CompanyRow | null;
    },
    enabled: !!slug,
    staleTime: 1000 * 60 * 2,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['company-services', company?.id],
    queryFn: async () => {
      if (!company?.id) return [] as CompanyService[];
      const { data: svc } = await supabase
        .from('services')
        .select('*')
        .eq('provider_id', company.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (!svc || svc.length === 0) return [] as CompanyService[];

      const serviceIds = svc.map((service: any) => service.id);
      const { data: serviceCategories } = await supabase
        .from('service_categories')
        .select('service_id, categories(name, icon)')
        .in('service_id', serviceIds);

      const categoryMap: Record<string, Array<{ name?: string | null; icon?: string | null }>> = {};
      (serviceCategories || []).forEach((row: any) => {
        if (!categoryMap[row.service_id]) categoryMap[row.service_id] = [];
        if (row.categories) categoryMap[row.service_id].push(row.categories);
      });

      return (svc as any[]).map((service) => ({
        ...service,
        serviceCategories: categoryMap[service.id] || [],
      }));
    },
    enabled: !!company?.id,
    staleTime: 1000 * 60 * 5,
  });

  // Galeria — primeiras 9 fotos do portfólio (se houver). Falha silenciosa.
  const { data: gallery = [] } = useQuery({
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
  const effectiveWhatsApp = company ? toCanonical(company.whatsapp || company.phone || '') : '';
  const heroStats = [
    company?.review_count ? { icon: Star, label: 'Avaliações', value: company.review_count } : null,
    services.length > 0 ? { icon: Briefcase, label: 'Serviços', value: services.length } : null,
    gallery.length > 0 ? { icon: ImageIcon, label: 'Fotos', value: gallery.length } : null,
  ].filter(Boolean) as Array<{ icon: typeof Star; label: string; value: number }>;

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

  const cityState = formatCityState(company?.city || '', company?.state || '') || company?.city || '';
  const companyCategory = useMemo(() => {
    const firstNamed = services.flatMap((service) => service.serviceCategories || []).find((category) => category?.name)?.name;
    return company?.business_segment || firstNamed || 'Empresa local';
  }, [company?.business_segment, services]);

  const seoTitle = truncateAt(
    company?.meta_title?.trim() || `${displayName} em ${cityState || 'sua cidade'} | Preciso de um`,
    60,
  );
  const seoDescription = truncateAt(
    company?.meta_description?.trim() ||
      `${displayName}${companyCategory ? `, ${companyCategory}` : ''}${cityState ? ` em ${cityState}` : ''}. Solicite contato direto pela plataforma e converse com segurança.`,
    160,
  );

  useSeoHead({
    title: seoTitle,
    description: seoDescription,
    canonical: company?.slug ? `${SITE_BASE_URL}/empresa/${company.slug}` : undefined,
    ogImage: company?.photo_url || gallery[0]?.optimized_url || gallery[0]?.url || undefined,
    ogType: 'profile',
  });

  const breadcrumbLd = useMemo(() => {
    if (!company?.slug) return null;
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Início', item: `${SITE_BASE_URL}/` },
        { '@type': 'ListItem', position: 2, name: 'Empresas', item: `${SITE_BASE_URL}/buscar` },
        { '@type': 'ListItem', position: 3, name: displayName, item: `${SITE_BASE_URL}/empresa/${company.slug}` },
      ],
    };
  }, [company?.slug, displayName]);

  const jsonLd = useMemo(() => {
    if (!company) return null;
    return {
      '@context': 'https://schema.org',
      '@type': ['Organization', 'LocalBusiness'],
      '@id': `${SITE_BASE_URL}/empresa/${company.slug}`,
      name: displayName,
      legalName: company.legal_name || undefined,
      description: company.description || undefined,
      image: company.photo_url || undefined,
      url: `${SITE_BASE_URL}/empresa/${company.slug}`,
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
      makesOffer: services.slice(0, 8).map((service) => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: service.service_name || service.name || 'Serviço',
          description: service.description || undefined,
          areaServed: service.service_area
            ? { '@type': 'City', name: service.service_area }
            : company.city
              ? { '@type': 'City', name: company.city }
              : undefined,
        },
      })),
    };
  }, [company, displayName, services, showFull]);

  useJsonLd(breadcrumbLd, `company-breadcrumb-${company?.id || slug}`);
  useJsonLd(jsonLd, `company-${company?.id || slug}`);

  useEffect(() => {
    if (company) trackProfileClick(company.id, company.slug, 'company-profile');
  }, [company]);

  useEffect(() => {
    const param = (slug || '').trim();
    if (!company?.slug || !param) return;
    if (param !== company.slug) {
      navigate(`/empresa/${company.slug}`, { replace: true });
    }
  }, [company?.slug, navigate, slug]);

  useEffect(() => {
    if (!company) return;
    setLeadForm((prev) => ({
      ...prev,
      city: prev.city || company.city || '',
      state: prev.state || (company.state || '').toUpperCase(),
      service: prev.service || services[0]?.service_name || services[0]?.name || '',
    }));
  }, [company, services]);

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    const ctxParts: string[] = [];
    const locStr = [leadForm.city, leadForm.state].filter(Boolean).join(' - ');
    if (locStr) ctxParts.push(`Localização: ${locStr}`);
    const origin = getLeadSource();
    if (origin && origin !== 'direto') ctxParts.push(`Origem: ${origin}`);
    if (companyCategory) ctxParts.push(`Segmento: ${companyCategory}`);
    const ctxBlock = ctxParts.length ? `\n\n— Contexto —\n${ctxParts.join('\n')}` : '';
    const finalMessage = `${leadForm.message || ''}${ctxBlock}`.trim();

    const { error: insertError } = await supabase.from('leads').insert({
      provider_id: company.id,
      client_name: leadForm.name,
      phone: leadForm.phone,
      service_needed: leadForm.service,
      message: finalMessage,
      lead_context: {
        city: leadForm.city || null,
        state: leadForm.state || null,
        category: companyCategory || null,
        origin: origin || 'direto',
        page: 'company_profile',
        provider_slug: company.slug,
        referrer: typeof document !== 'undefined' ? document.referrer || null : null,
        captured_at: new Date().toISOString(),
      },
      preferred_window: preferredWindow ?? null,
    } as any);

    if (insertError) {
      toast.error('Erro ao enviar solicitação');
      return;
    }

    setLeadSent(true);
    toast.success('Solicitação enviada com sucesso!');
  };

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
        <nav className="container py-3 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors">Início</Link>
          <ChevronRight className="mx-1 inline h-3 w-3" />
          <Link to="/buscar" className="hover:text-foreground transition-colors">Empresas</Link>
          <ChevronRight className="mx-1 inline h-3 w-3" />
          <span className="font-medium text-foreground">{displayName}</span>
        </nav>

        <section className="py-6">
          <div className="container">
            <div className="mx-auto max-w-4xl overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start">
                <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted shadow-sm sm:h-32 sm:w-32">
                  {company.photo_url ? (
                    <img
                      src={company.photo_url}
                      alt={`Logo ${displayName}`}
                      fetchPriority="high"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Building2 className="h-14 w-14 text-muted-foreground/40" aria-hidden="true" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="inline-flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {isCompany ? 'Empresa / Unidade Física' : 'Perfil profissional'}
                    </Badge>
                    {cityState && (
                      <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" aria-hidden="true" />
                        {cityState}
                      </span>
                    )}
                  </div>

                  <h1 className="mt-3 font-display text-3xl font-bold text-foreground md:text-4xl">
                    {displayName}
                  </h1>

                  {companyCategory && (
                    <p className="mt-1 text-base text-muted-foreground">{companyCategory}</p>
                  )}

                  {(company.rating_avg || 0) > 0 && (
                    <div className="mt-3 flex items-center gap-1.5 text-sm">
                      <Star className="h-4 w-4 fill-accent text-accent" aria-hidden="true" />
                      <span className="font-bold">{Number(company.rating_avg).toFixed(1)}</span>
                      {company.review_count ? (
                        <span className="text-muted-foreground">({company.review_count} avaliações)</span>
                      ) : null}
                    </div>
                  )}

                  {heroStats.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                      {heroStats.map((stat) => {
                        const Icon = stat.icon;
                        return (
                          <div key={stat.label} className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                            <Icon className="h-4 w-4 text-accent" aria-hidden="true" />
                            <span className="font-semibold text-foreground">{stat.value}</span>
                            <span className="text-muted-foreground">{stat.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Button variant="accent" size="lg" onClick={() => { setLeadSent(false); setLeadDialogOpen(true); }}>
                      <Send className="mr-2 h-4 w-4" aria-hidden="true" />
                      Solicitar contato
                    </Button>

                    {effectiveWhatsApp && (
                      <Button
                        size="lg"
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={() => {
                          trackWhatsAppClick(company.id, company.slug, 'company-profile');
                          requestWhatsApp({
                            url: whatsappLink(
                              effectiveWhatsApp,
                              `Olá ${displayName}! Vi sua empresa no Preciso de um e gostaria de conversar sobre uma necessidade.`,
                            ),
                            targetType: 'provider',
                            targetId: company.id,
                            targetLabel: displayName,
                            whatsappNumber: effectiveWhatsApp,
                          });
                        }}
                      >
                        <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                        Chamar no WhatsApp
                      </Button>
                    )}
                  </div>
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

        {services.length > 0 && (
          <section className="border-t border-border py-8">
            <div className="container max-w-4xl">
              <h2 className="mb-4 font-display text-xl font-bold">Serviços e frentes de atendimento</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {services.slice(0, 8).map((service) => (
                  <article key={service.id} className="rounded-lg border border-border bg-card p-4">
                    <h3 className="font-semibold text-foreground">{service.service_name || service.name || 'Serviço'}</h3>
                    {service.description && (
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{service.description}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {service.service_area && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">
                          <MapPin className="h-3 w-3" aria-hidden="true" />
                          {service.service_area}
                        </span>
                      )}
                      {service.serviceCategories?.map((category) => category?.name).filter(Boolean).slice(0, 2).map((categoryName) => (
                        <span key={categoryName} className="rounded-md border border-border px-2 py-1">{categoryName}</span>
                      ))}
                    </div>
                  </article>
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
        {(company.website || (company.social_links && Object.keys(company.social_links).length > 0)) && (
          <section className="py-8">
            <div className="container max-w-4xl">
              <h2 className="mb-3 font-display text-xl font-bold">Onde nos encontrar</h2>
              <div className="flex flex-wrap gap-2">
                {company.website && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={company.website} target="_blank" rel="noopener noreferrer">
                      <Globe className="mr-2 h-4 w-4" aria-hidden="true" /> Site
                    </a>
                  </Button>
                )}
                {company.social_links?.website && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={company.social_links.website} target="_blank" rel="noopener noreferrer">
                      <Globe className="mr-2 h-4 w-4" aria-hidden="true" /> Site
                    </a>
                  </Button>
                )}
                {company.social_links?.instagram && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={company.social_links.instagram} target="_blank" rel="noopener noreferrer">
                      <Instagram className="mr-2 h-4 w-4" aria-hidden="true" /> Instagram
                    </a>
                  </Button>
                )}
                {company.social_links?.facebook && (
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

        <Dialog open={leadDialogOpen} onOpenChange={setLeadDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10">
                  <Send className="h-4 w-4 text-accent" />
                </div>
                Solicitar contato
              </DialogTitle>
            </DialogHeader>

            {leadSent ? (
              <div className="space-y-3 rounded-xl bg-accent/10 p-6 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/20">
                  <CheckCircle2 className="h-7 w-7 text-accent" />
                </div>
                <p className="text-base font-semibold text-foreground">Solicitação enviada!</p>
                <p className="text-sm text-muted-foreground">A empresa receberá sua solicitação e poderá responder pelos canais disponíveis no perfil.</p>
                <Button variant="outline" onClick={() => setLeadDialogOpen(false)}>Fechar</Button>
              </div>
            ) : (
              <form onSubmit={handleLeadSubmit} className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Seu nome</label>
                  <input
                    type="text"
                    required
                    value={leadForm.name}
                    onChange={(e) => setLeadForm((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none"
                    placeholder="Como quer ser chamado?"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Telefone</label>
                  <input
                    type="tel"
                    required
                    value={leadForm.phone}
                    onChange={(e) => setLeadForm((prev) => ({ ...prev, phone: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none"
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">O que você precisa?</label>
                  <input
                    type="text"
                    required
                    value={leadForm.service}
                    onChange={(e) => setLeadForm((prev) => ({ ...prev, service: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none"
                    placeholder={services[0]?.service_name || services[0]?.name || 'Ex: Instalação, manutenção, atendimento'}
                  />
                </div>
                <div className="grid grid-cols-[1fr_84px] gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Sua cidade</label>
                    <input
                      type="text"
                      value={leadForm.city}
                      onChange={(e) => setLeadForm((prev) => ({ ...prev, city: e.target.value }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none"
                      placeholder="Cidade"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">UF</label>
                    <input
                      type="text"
                      maxLength={2}
                      value={leadForm.state}
                      onChange={(e) => setLeadForm((prev) => ({ ...prev, state: e.target.value.toUpperCase().slice(0, 2) }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm uppercase text-foreground outline-none"
                      placeholder="UF"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Mensagem</label>
                  <textarea
                    rows={3}
                    value={leadForm.message}
                    onChange={(e) => setLeadForm((prev) => ({ ...prev, message: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none"
                    placeholder="Descreva rapidamente sua necessidade"
                  />
                </div>
                <ContactWindowPicker
                  value={preferredWindow}
                  onChange={setPreferredWindow}
                  providerHours={normalizeContactHours(company.contact_hours)}
                  helperText="Ajuda a empresa a responder no melhor horário."
                />
                <Button type="submit" variant="accent" className="w-full gap-2">
                  <Send className="h-4 w-4" /> Enviar solicitação
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </main>
      <Footer />
    </>
  );
}
