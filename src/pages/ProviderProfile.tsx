import { useParams, Link, useNavigate } from 'react-router-dom';
import { avatarLarge, portfolioThumb, portfolioFull, coverImage, serviceImageThumb } from '@/lib/imageOptimizer';
import { MapPin, Phone, Globe, MessageCircle, Clock, ChevronRight, Crown, Copy, Instagram, Facebook, Youtube } from 'lucide-react';
import { whatsappLink, telLink, toCanonical } from '@/lib/whatsapp';
import ImageLightbox from '@/components/ImageLightbox';
import { useIsMobile } from '@/hooks/use-mobile';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import StarRating from '@/components/StarRating';
import SponsorAd from '@/components/SponsorAd';
import { lazy, Suspense } from 'react';
const AdSlot = lazy(() => import('@/components/ads/AdSlot'));
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeSlug } from '@/lib/slugify';
import { toast } from 'sonner';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { useJsonLd } from '@/hooks/useJsonLd';
import { useFeatureEnabled } from '@/hooks/useSiteSettings';

interface PageSettings {
  sections_order: string[];
  hidden_sections: string[];
  headline: string;
  tagline: string;
  cta_text: string;
  cta_whatsapp_text: string;
  accent_color: string;
  cover_image_url: string;
  instagram_url: string;
  facebook_url: string;
  youtube_url: string;
  tiktok_url: string;
  theme: string;
}

const DEFAULT_SETTINGS: PageSettings = {
  sections_order: ['about', 'portfolio', 'services', 'reviews', 'lead_form'],
  hidden_sections: [],
  headline: '',
  tagline: '',
  cta_text: 'Solicitar Orçamento',
  cta_whatsapp_text: 'Chamar no WhatsApp',
  accent_color: '',
  cover_image_url: '',
  instagram_url: '',
  facebook_url: '',
  youtube_url: '',
  tiktok_url: '',
  theme: 'default',
};

interface ThemeConfig {
  card: string;
  section: string;
  page: string;
  heading: string;
  button: string;
  buttonOutline: string;
  fontBody: string;
  fontHeading: string;
  badge: string;
  input: string;
}

interface ProviderProfileSnapshot {
  provider: any;
  services: any[];
  reviews: any[];
  portfolioImages: string[];
  portfolioRawUrls: string[];
  pageSettings: PageSettings;
}

const PROVIDER_PROFILE_CACHE_TTL = 1000 * 60 * 15;
const providerProfileCache = new Map<string, { ts: number; snapshot: ProviderProfileSnapshot }>();

const THEME_CLASSES: Record<string, ThemeConfig> = {
  default: {
    card: 'rounded-xl border border-border bg-card shadow-card',
    section: 'rounded-xl border border-border bg-card p-6 shadow-card',
    page: '',
    heading: 'font-display',
    button: 'rounded-md',
    buttonOutline: 'rounded-md border border-input',
    fontBody: 'font-sans',
    fontHeading: "font-['Plus_Jakarta_Sans']",
    badge: 'rounded-full',
    input: 'rounded-md border border-input',
  },
  moderno: {
    card: 'rounded-2xl border-0 bg-gradient-to-br from-card to-accent/5 shadow-lg',
    section: 'rounded-2xl border-0 bg-gradient-to-br from-card to-accent/5 p-6 shadow-lg',
    page: 'bg-gradient-to-b from-background to-accent/5',
    heading: "font-['Space_Grotesk'] tracking-tight",
    button: 'rounded-xl shadow-lg',
    buttonOutline: 'rounded-xl border-2 border-primary/20',
    fontBody: "font-['DM_Sans']",
    fontHeading: "font-['Space_Grotesk']",
    badge: 'rounded-xl',
    input: 'rounded-xl border-0 bg-muted/50 shadow-inner',
  },
  classico: {
    card: 'rounded-lg border-2 border-amber-200/60 bg-amber-50/30 shadow-sm',
    section: 'rounded-lg border-2 border-amber-200/60 bg-amber-50/30 p-6 shadow-sm',
    page: 'bg-amber-50/20',
    heading: "font-['Playfair_Display'] italic",
    button: 'rounded-lg border-2',
    buttonOutline: 'rounded-lg border-2 border-amber-300/60',
    fontBody: "font-['DM_Sans']",
    fontHeading: "font-['Playfair_Display']",
    badge: 'rounded-lg border border-amber-200/60',
    input: 'rounded-lg border-2 border-amber-200/40',
  },
  minimalista: {
    card: 'rounded-none border-0 border-b border-border/30 bg-transparent shadow-none',
    section: 'rounded-none border-0 border-b border-border/30 bg-transparent p-6 shadow-none',
    page: 'bg-background',
    heading: "font-['Space_Grotesk'] font-light tracking-[0.2em] uppercase text-sm",
    button: 'rounded-none border-b-2 border-foreground bg-transparent text-foreground shadow-none hover:bg-foreground hover:text-background',
    buttonOutline: 'rounded-none border-b border-border/50',
    fontBody: "font-['DM_Sans'] font-light",
    fontHeading: "font-['Space_Grotesk']",
    badge: 'rounded-none border-b border-border/30',
    input: 'rounded-none border-0 border-b border-border/50 bg-transparent',
  },
};

const ProviderProfile = () => {
  const isMobile = useIsMobile();
  const reviewsEnabled = useFeatureEnabled('reviews_enabled');
  const { slug } = useParams();
  const navigate = useNavigate();
  const [provider, setProvider] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [portfolioImages, setPortfolioImages] = useState<string[]>([]);
  const [portfolioRawUrls, setPortfolioRawUrls] = useState<string[]>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [leadSent, setLeadSent] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: '', phone: '', service: '', message: '' });
  const [pageSettings, setPageSettings] = useState<PageSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let active = true;

    const applySnapshot = (snapshot: ProviderProfileSnapshot) => {
      if (!active) return;
      setProvider(snapshot.provider);
      setServices(snapshot.services);
      setReviews(snapshot.reviews);
      setPortfolioRawUrls(snapshot.portfolioRawUrls);
      setPortfolioImages(snapshot.portfolioImages);
      setPageSettings(snapshot.pageSettings);
      setLoading(false);
    };

    const fetchProvider = async () => {
      if (!slug) {
        if (active) setLoading(false);
        return;
      }

      const cached = providerProfileCache.get(slug);
      if (cached && Date.now() - cached.ts < PROVIDER_PROFILE_CACHE_TTL) {
        applySnapshot(cached.snapshot);
        return;
      }

      if (active) setLoading(true);

      // Try exact match first
      let { data } = await supabase
        .from('providers')
        .select('*, categories(name, slug, icon)')
        .eq('slug', slug)
        .maybeSingle();

      // If not found, try sanitized version of the URL slug
      if (!data && slug) {
        const sanitized = sanitizeSlug(slug);
        if (sanitized !== slug) {
          const { data: fallback } = await supabase
            .from('providers')
            .select('*, categories(name, slug, icon)')
            .eq('slug', sanitized)
            .maybeSingle();
          if (fallback) {
            // Redirect to the canonical URL (301-style client redirect)
            navigate(`/profissional/${fallback.slug}`, { replace: true });
            return;
          }
        }
      }

      if (data) {
        let preparedPageSettings: PageSettings = DEFAULT_SETTINGS;
        let preparedServices: any[] = [];
        let preparedReviews: any[] = [];
        let preparedPortfolioRawUrls: string[] = [];
        let preparedPortfolioImages: string[] = [];

        const { data: profile } = await supabase
          .from('public_profiles' as any)
          .select('full_name, avatar_url')
          .eq('id', data.user_id)
          .maybeSingle();

        const providerWithProfile = { ...data, profiles: profile };

        const [{ data: svc }, { data: rev }, { data: files }, { data: ps }] = await Promise.all([
          supabase.from('services').select('*').eq('provider_id', data.id),
          supabase.from('reviews')
            .select('*, user_id')
            .eq('provider_id', data.id)
            .order('created_at', { ascending: false }),
          supabase.storage.from('portfolio').list(`${data.user_id}`, { limit: 20 }),
          supabase.from('provider_page_settings').select('*').eq('provider_id', data.id).maybeSingle(),
        ]);

        if (ps) {
          preparedPageSettings = {
            sections_order: (ps.sections_order as string[]) || DEFAULT_SETTINGS.sections_order,
            hidden_sections: (ps.hidden_sections as string[]) || [],
            headline: ps.headline || '',
            tagline: ps.tagline || '',
            cta_text: ps.cta_text || DEFAULT_SETTINGS.cta_text,
            cta_whatsapp_text: ps.cta_whatsapp_text || DEFAULT_SETTINGS.cta_whatsapp_text,
            accent_color: ps.accent_color || '',
            cover_image_url: ps.cover_image_url || '',
            instagram_url: ps.instagram_url || '',
            facebook_url: ps.facebook_url || '',
            youtube_url: ps.youtube_url || '',
            tiktok_url: ps.tiktok_url || '',
            theme: (ps as any).theme || 'default',
          };
        }

        if (svc && svc.length > 0) {
          const svcIds = svc.map((s: any) => s.id);
          const [{ data: scData }, { data: siData }] = await Promise.all([
            supabase.from('service_categories')
              .select('service_id, category_id, categories(name, icon)')
              .in('service_id', svcIds),
            supabase.from('service_images')
              .select('*')
              .in('service_id', svcIds)
              .order('display_order'),
          ]);

          const catMap: Record<string, any[]> = {};
          (scData || []).forEach((sc: any) => {
            if (!catMap[sc.service_id]) catMap[sc.service_id] = [];
            catMap[sc.service_id].push(sc.categories);
          });

          const imgMap: Record<string, any[]> = {};
          (siData || []).forEach((si: any) => {
            if (!imgMap[si.service_id]) imgMap[si.service_id] = [];
            imgMap[si.service_id].push(si);
          });

          preparedServices = svc.map((s: any) => ({
            ...s,
            serviceCategories: catMap[s.id] || [],
            serviceImages: imgMap[s.id] || [],
          }));
        }

        if (rev && rev.length > 0) {
          const reviewUserIds = [...new Set(rev.map((r: any) => r.user_id))];
          const { data: reviewProfiles } = await supabase
            .from('public_profiles' as any)
            .select('id, full_name')
            .in('id', reviewUserIds);
          const profileMap: Record<string, string> = {};
          (reviewProfiles || []).forEach((p: any) => { profileMap[p.id] = p.full_name; });
          preparedReviews = rev.map((r: any) => ({ ...r, profiles: { full_name: profileMap[r.user_id] || 'Cliente' } }));
        }

        if (files) {
          const filtered = files.filter(f => f.name !== '.emptyFolderPlaceholder');
          preparedPortfolioRawUrls = filtered.map(f => supabase.storage.from('portfolio').getPublicUrl(`${data.user_id}/${f.name}`).data.publicUrl);
          preparedPortfolioImages = preparedPortfolioRawUrls.map(u => portfolioThumb(u));
        }

        const snapshot: ProviderProfileSnapshot = {
          provider: providerWithProfile,
          services: preparedServices,
          reviews: preparedReviews,
          portfolioImages: preparedPortfolioImages,
          portfolioRawUrls: preparedPortfolioRawUrls,
          pageSettings: preparedPageSettings,
        };

        providerProfileCache.set(slug, { ts: Date.now(), snapshot });
        applySnapshot(snapshot);
        return;
      }

      if (active) {
        setProvider(null);
        setServices([]);
        setReviews([]);
        setPortfolioImages([]);
        setPortfolioRawUrls([]);
        setPageSettings(DEFAULT_SETTINGS);
        setLoading(false);
      }
    };

    fetchProvider();

    return () => {
      active = false;
    };
  }, [slug, navigate]);

  const name = provider ? ((provider.profiles as any)?.full_name || provider.business_name || 'Profissional') : '';
  const avatarUrl = provider ? avatarLarge((provider.profiles as any)?.avatar_url || provider.photo_url) : '';
  const category = provider ? ((provider.categories as any)?.name || '') : '';
  const categorySlug = provider ? ((provider.categories as any)?.slug || '') : '';
  const initials = name ? name.split(' ').map((n: string) => n[0]).join('').slice(0, 2) : '';
  // Auto-fill WhatsApp from phone if empty
  const effectiveWhatsApp = provider ? toCanonical(provider.whatsapp || provider.phone || '') : '';

  const hasSocial = pageSettings.instagram_url || pageSettings.facebook_url || pageSettings.youtube_url || pageSettings.tiktok_url;

  useSeoHead({
    title: provider ? `${name} - ${category} em ${provider.city}` : 'Profissional',
    description: provider
      ? `${name}, ${category} em ${provider.city}-${provider.state}. ${provider.review_count} avaliações, nota ${Number(provider.rating_avg).toFixed(1)}.`
      : 'Encontre profissionais na plataforma.',
    canonical: slug ? `${SITE_BASE_URL}/profissional/${slug}` : undefined,
  });

  const breadcrumbLd = useMemo(() => provider ? ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: `${SITE_BASE_URL}/` },
      ...(categorySlug ? [{ '@type': 'ListItem', position: 2, name: category, item: `${SITE_BASE_URL}/categoria/${categorySlug}` }] : []),
      { '@type': 'ListItem', position: categorySlug ? 3 : 2, name },
    ],
  }) : null, [provider, name, category, categorySlug]);

  const localBusinessLd = useMemo(() => provider ? ({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: provider.business_name || name,
    description: provider.description,
    image: avatarUrl || undefined,
    telephone: provider.phone,
    address: { '@type': 'PostalAddress', addressLocality: provider.city, addressRegion: provider.state, addressCountry: 'BR' },
    ...(provider.review_count > 0 ? {
      aggregateRating: { '@type': 'AggregateRating', ratingValue: Number(provider.rating_avg).toFixed(1), reviewCount: provider.review_count, bestRating: 5 },
    } : {}),
    url: `${SITE_BASE_URL}/profissional/${slug}`,
  }) : null, [provider, name, avatarUrl, slug]);

  useJsonLd(breadcrumbLd);
  useJsonLd(localBusinessLd);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="container py-8">
          <Skeleton className="mb-4 h-40 rounded-xl" />
          <Skeleton className="mb-4 h-32 rounded-xl" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="container flex flex-1 items-center justify-center py-20">
          <p className="text-lg text-muted-foreground">Profissional não encontrado.</p>
        </div>
        <Footer />
      </div>
    );
  }

  const accentStyle = pageSettings.accent_color
    ? { '--provider-accent': pageSettings.accent_color } as React.CSSProperties
    : {};

  const accentBg = pageSettings.accent_color ? `hsl(${pageSettings.accent_color})` : undefined;

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('leads').insert({
      provider_id: provider.id,
      client_name: leadForm.name,
      phone: leadForm.phone,
      service_needed: leadForm.service,
      message: leadForm.message,
    });
    if (error) {
      toast.error('Erro ao enviar solicitação');
      return;
    }
    setLeadSent(true);
    toast.success('Solicitação enviada!');
  };

  const citySlug = provider.city?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');

  const visibleSections = pageSettings.sections_order.filter(s => !pageSettings.hidden_sections.includes(s));
  const tc = THEME_CLASSES[pageSettings.theme] || THEME_CLASSES.default;

  // Section renderers
  const renderAbout = () => (
    <div key="about" className={`mt-6 p-6 ${tc.section}`}>
      <h2 className={`${tc.heading} text-lg font-bold text-foreground`}>Sobre o profissional</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {provider.description || 'Este profissional ainda não adicionou uma descrição.'}
      </p>
    </div>
  );

  const openPortfolioLightbox = (index: number) => {
    setLightboxImages(portfolioRawUrls);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const openServiceLightbox = (images: string[], index: number) => {
    setLightboxImages(images);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const renderPortfolio = () => {
    if (portfolioImages.length === 0) return null;
    return (
      <div key="portfolio" className={`mt-6 p-6 ${tc.section}`}>
        <h2 className={`${tc.heading} text-lg font-bold text-foreground`}>Portfólio</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {portfolioImages.map((url, i) => (
            <div key={i} className="aspect-square cursor-pointer overflow-hidden rounded-lg border border-border transition-transform hover:scale-[1.02]" onClick={() => openPortfolioLightbox(i)}>
              <img src={url} alt={`Trabalho ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderServices = () => (
    <ServicesList key="services" services={services} whatsapp={effectiveWhatsApp} providerName={name} providerCity={provider.city} ctaWhatsappText={pageSettings.cta_whatsapp_text} accentBg={accentBg} themeClasses={tc} onImageClick={openServiceLightbox} />
  );

  const renderReviews = () => {
    if (!reviewsEnabled) return null;
    return (
      <div key="reviews" className={`mt-6 p-6 ${tc.section}`}>
        <h2 className={`${tc.heading} text-lg font-bold text-foreground`}>Avaliações</h2>
        {reviews.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma avaliação ainda.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {reviews.map((r) => (
              <div key={r.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">
                    {(r.profiles as any)?.full_name || 'Cliente'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div className="mt-1">
                  <StarRating rating={r.rating} showValue={false} size={12} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderLeadForm = () => (
    <div key="lead_form" className={`mt-6 w-full lg:hidden p-6 ${tc.section}`}>
      <h3 className={`${tc.heading} text-lg font-bold text-foreground`}>{pageSettings.cta_text}</h3>
      {leadSent ? (
        <div className="mt-4 rounded-lg bg-success/10 p-4 text-center">
          <p className="text-sm font-semibold text-foreground">Solicitação enviada!</p>
          <p className="mt-1 text-xs text-muted-foreground">O profissional entrará em contato em breve.</p>
        </div>
      ) : (
        <form onSubmit={handleLeadSubmit} className="mt-4 space-y-3">
          <input type="text" placeholder="Seu nome" required value={leadForm.name}
            onChange={(e) => setLeadForm(prev => ({ ...prev, name: e.target.value }))}
            className={`w-full ${tc.input} bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground`} />
          <input type="tel" placeholder="Seu telefone" required value={leadForm.phone}
            onChange={(e) => setLeadForm(prev => ({ ...prev, phone: e.target.value }))}
            className={`w-full ${tc.input} bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground`} />
          <input type="text" placeholder="Serviço necessário" required value={leadForm.service}
            onChange={(e) => setLeadForm(prev => ({ ...prev, service: e.target.value }))}
            className={`w-full ${tc.input} bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground`} />
          <textarea placeholder="Descreva o que precisa..." rows={3} value={leadForm.message}
            onChange={(e) => setLeadForm(prev => ({ ...prev, message: e.target.value }))}
            className={`w-full ${tc.input} bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground`} />
          <Button type="submit" variant="accent" className={`w-full ${tc.button}`} style={accentBg ? { backgroundColor: accentBg } : undefined}>
            Enviar Solicitação
          </Button>
        </form>
      )}
    </div>
  );

  const sectionMap: Record<string, () => React.ReactNode> = {
    about: renderAbout,
    portfolio: renderPortfolio,
    services: renderServices,
    reviews: renderReviews,
    lead_form: renderLeadForm,
  };

  return (
    <div className={`flex min-h-screen flex-col ${tc.page} ${tc.fontBody}`} style={accentStyle}>
      <Header />

      {/* Cover Image Hero */}
      {pageSettings.cover_image_url && (
        <div className="relative w-full aspect-[16/5] sm:aspect-[16/5] overflow-hidden">
          <img src={coverImage(pageSettings.cover_image_url)} alt="Capa" className="h-full w-full object-cover" loading="eager" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 container pb-6 text-white">
            {pageSettings.headline && (
              <h2 className="font-display text-xl sm:text-3xl font-bold drop-shadow-lg">{pageSettings.headline}</h2>
            )}
            {pageSettings.tagline && (
              <p className="mt-1 text-sm sm:text-lg opacity-90 drop-shadow">{pageSettings.tagline}</p>
            )}
          </div>
        </div>
      )}

      {/* Headline without cover */}
      {!pageSettings.cover_image_url && (pageSettings.headline || pageSettings.tagline) && (
        <div className="container pt-6">
          {pageSettings.headline && (
            <h2 className="font-display text-xl font-bold text-foreground">{pageSettings.headline}</h2>
          )}
          {pageSettings.tagline && (
            <p className="mt-1 text-sm text-muted-foreground">{pageSettings.tagline}</p>
          )}
        </div>
      )}

      {/* Breadcrumb */}
      <nav className="container py-3 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Início</Link>
        {categorySlug && (
          <>
            <ChevronRight className="mx-1 inline h-3 w-3" />
            <Link to={`/categoria/${categorySlug}`} className="hover:text-foreground">{category}</Link>
          </>
        )}
        {provider.city && (
          <>
            <ChevronRight className="mx-1 inline h-3 w-3" />
            <Link to={`/cidade/${citySlug}`} className="hover:text-foreground">{provider.city}</Link>
          </>
        )}
        <ChevronRight className="mx-1 inline h-3 w-3" />
        <span className="text-foreground">{name}</span>
      </nav>

      {/* Profile Top Ad Slot */}
      <Suspense fallback={null}><AdSlot slotSlug="profile-top" category={category} city={provider.city} state={provider.state} /></Suspense>

      <div className="container py-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="flex-1">
            {/* Profile header */}
            <div className={`p-6 ${tc.card}`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <Avatar className="h-20 w-20 shrink-0 rounded-2xl">
                  <AvatarImage src={avatarUrl || undefined} alt={name} className="rounded-2xl" />
                  <AvatarFallback className="rounded-2xl bg-primary text-2xl font-bold text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h1 className="font-display text-2xl font-bold text-foreground">{name}</h1>
                    {provider.plan === 'premium' && (
                      <span className={`inline-flex items-center gap-1 ${tc.badge} bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground`} style={accentBg ? { backgroundColor: accentBg } : undefined}>
                        <Crown className="h-3 w-3" /> DESTAQUE
                      </span>
                    )}
                  </div>
                  {provider.business_name && (
                    <p className="text-sm text-muted-foreground">{provider.business_name}</p>
                  )}
                  <p className="mt-1 text-sm font-medium" style={accentBg ? { color: accentBg } : undefined}>
                    {category || 'Categoria não informada'}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {provider.city
                        ? `${provider.neighborhood ? `${provider.neighborhood}, ` : ''}${provider.city} - ${provider.state}`
                        : 'Localização não informada'}
                    </span>
                    {provider.years_experience > 0 && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {provider.years_experience} anos de experiência
                      </span>
                    )}
                  </div>
                  {reviewsEnabled && (
                    <div className="mt-3">
                      <StarRating rating={Number(provider.rating_avg)} count={provider.review_count} />
                    </div>
                  )}
                  {/* Social links */}
                  {hasSocial && (
                    <div className="mt-3 flex gap-2">
                      {pageSettings.instagram_url && (
                        <a href={pageSettings.instagram_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                          <Instagram className="h-5 w-5" />
                        </a>
                      )}
                      {pageSettings.facebook_url && (
                        <a href={pageSettings.facebook_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                          <Facebook className="h-5 w-5" />
                        </a>
                      )}
                      {pageSettings.youtube_url && (
                        <a href={pageSettings.youtube_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                          <Youtube className="h-5 w-5" />
                        </a>
                      )}
                      {pageSettings.tiktok_url && (
                        <a href={pageSettings.tiktok_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-bold">
                          🎵
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {effectiveWhatsApp && (
                  <Button variant="accent" size="lg" className={tc.button} asChild style={accentBg ? { backgroundColor: accentBg } : undefined}>
                    <a href={whatsappLink(effectiveWhatsApp, `Olá! Vi seu perfil "${name}" no Preciso de um e gostaria de um orçamento.`)} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-5 w-5" /> {pageSettings.cta_whatsapp_text}
                    </a>
                  </Button>
                )}
                {isMobile && provider.phone && telLink(provider.phone) && (
                  <Button variant="outline" size="lg" className={tc.buttonOutline} asChild>
                    <a href={telLink(provider.phone)}>
                      <Phone className="h-5 w-5" /> Ligar
                    </a>
                  </Button>
                )}
                <Button variant="outline" size="lg" onClick={() => {
                  navigator.clipboard.writeText(window.location.href).then(() => {
                    toast.success('Link copiado!');
                  }).catch(() => {
                    window.prompt('Copie o link:', window.location.href);
                  });
                }}>
                  <Copy className="h-4 w-4" /> Copiar Link
                </Button>
              </div>
            </div>

            {/* Dynamic sections with ad slots interspersed */}
            {visibleSections.map((sectionId, idx) => {
              const render = sectionMap[sectionId];
              return (
                <div key={sectionId}>
                  {render ? render() : null}
                  {sectionId === 'about' && (
                    <Suspense fallback={null}><AdSlot slotSlug="profile-after-desc" category={category} city={provider.city} state={provider.state} /></Suspense>
                  )}
                  {sectionId === 'services' && (
                    <Suspense fallback={null}><AdSlot slotSlug="profile-between-services" category={category} city={provider.city} state={provider.state} /></Suspense>
                  )}
                </div>
              );
            })}
          </div>

          {/* Sidebar */}
          <aside className="hidden lg:block w-80">
            <div className={`sticky top-20 p-6 ${tc.card}`}>
              <h3 className={`${tc.heading} text-lg font-bold text-foreground`}>{pageSettings.cta_text}</h3>
              {leadSent ? (
                <div className="mt-4 rounded-lg bg-success/10 p-4 text-center">
                  <p className="text-sm font-semibold text-foreground">Solicitação enviada!</p>
                  <p className="mt-1 text-xs text-muted-foreground">O profissional entrará em contato em breve.</p>
                </div>
              ) : (
                <form onSubmit={handleLeadSubmit} className="mt-4 space-y-3">
                  <input type="text" placeholder="Seu nome" required value={leadForm.name}
                    onChange={(e) => setLeadForm(prev => ({ ...prev, name: e.target.value }))}
                    className={`w-full ${tc.input} bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground`} />
                  <input type="tel" placeholder="Seu telefone" required value={leadForm.phone}
                    onChange={(e) => setLeadForm(prev => ({ ...prev, phone: e.target.value }))}
                    className={`w-full ${tc.input} bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground`} />
                  <input type="text" placeholder="Serviço necessário" required value={leadForm.service}
                    onChange={(e) => setLeadForm(prev => ({ ...prev, service: e.target.value }))}
                    className={`w-full ${tc.input} bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground`} />
                  <textarea placeholder="Descreva o que precisa..." rows={3} value={leadForm.message}
                    onChange={(e) => setLeadForm(prev => ({ ...prev, message: e.target.value }))}
                    className={`w-full ${tc.input} bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground`} />
                  <Button type="submit" variant="accent" className={`w-full ${tc.button}`} style={accentBg ? { backgroundColor: accentBg } : undefined}>
                    Enviar Solicitação
                  </Button>
                </form>
              )}
            </div>
            <SponsorAd position="sidebar" layout="vertical" className="mt-4" />
          </aside>
      </div>
      {/* Profile footer ad slot */}
      <Suspense fallback={null}><AdSlot slotSlug="profile-footer" category={category} city={provider.city} state={provider.state} /></Suspense>
      </div>
      {/* Floating WhatsApp Button — same pattern as homepage FloatingWhatsApp */}
      {effectiveWhatsApp && (
        <a
          href={whatsappLink(effectiveWhatsApp, `Olá! Vi seu perfil "${name}" no Preciso de um e gostaria de um orçamento.`)}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed right-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-110 active:scale-95"
          style={{
            zIndex: 9999,
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 90px)',
          }}
          aria-label="WhatsApp"
        >
          <MessageCircle className="h-5 w-5" />
        </a>
      )}
      <Footer />
      <ImageLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
};

/* ── Service Detail Dialog ── */
const ServiceDetailDialog = ({ service, open, onClose, whatsapp, ctaWhatsappText, accentBg, onImageClick }: { service: any; open: boolean; onClose: () => void; whatsapp: string; ctaWhatsappText?: string; accentBg?: string; onImageClick?: (images: string[], index: number) => void }) => (
  <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle className="text-lg font-bold">{service.service_name}</DialogTitle>
      </DialogHeader>
      {service.serviceImages?.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {service.serviceImages.map((img: any, idx: number) => (
            <div
              key={img.id}
              className="aspect-video cursor-pointer overflow-hidden rounded-lg border border-border transition-transform hover:scale-[1.02]"
              onClick={() => onImageClick?.(service.serviceImages.map((i: any) => i.image_url), idx)}
            >
              <img src={serviceImageThumb(img.image_url)} alt="Foto do serviço" className="h-full w-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
      )}
      {service.serviceCategories?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {service.serviceCategories.map((cat: any, i: number) => (
            <span key={i} className="inline-flex items-center gap-0.5 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
              {cat.icon} {cat.name}
            </span>
          ))}
        </div>
      )}
      {service.description && <p className="text-sm text-muted-foreground leading-relaxed">{service.description}</p>}
      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
        {service.price && <span className="font-semibold text-foreground">💰 {service.price}</span>}
        {service.service_area && <span>📍 {service.service_area}</span>}
        {service.working_hours && <span>🕐 {service.working_hours}</span>}
      </div>
      <Button variant="accent" className="w-full" asChild style={accentBg ? { backgroundColor: accentBg } : undefined}>
        <a href={whatsappLink(whatsapp || '', `Olá! Vi seu serviço no Preciso de um e gostaria de mais informações.`)} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="h-4 w-4" /> {ctaWhatsappText || 'Chamar no WhatsApp'}
        </a>
      </Button>
    </DialogContent>
  </Dialog>
);

/* ── Services List with popup ── */
const ServicesList = ({ services, whatsapp, providerName, providerCity, ctaWhatsappText, accentBg, themeClasses, onImageClick }: { services: any[]; whatsapp: string; providerName: string; providerCity: string; ctaWhatsappText?: string; accentBg?: string; themeClasses?: ThemeConfig; onImageClick?: (images: string[], index: number) => void }) => {
  const [selected, setSelected] = useState<any | null>(null);
  const tc = themeClasses || THEME_CLASSES.default;

  return (
    <>
      <div className={`mt-6 p-6 ${tc.section}`}>
        <h2 className={`${tc.heading} text-lg font-bold text-foreground`}>Serviços oferecidos</h2>
        <div className="mt-4 space-y-3">
          {services.map((s: any) => (
            <button
              key={s.id}
              onClick={() => setSelected(s)}
              className="w-full text-left rounded-lg border border-border p-4 transition-all hover:border-primary/30 hover:shadow-sm"
            >
              <h3 className="text-sm font-semibold text-foreground">{s.service_name}</h3>
              {s.serviceCategories?.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {s.serviceCategories.map((cat: any, i: number) => (
                    <span key={i} className="inline-flex items-center gap-0.5 rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent">
                      {cat.icon} {cat.name}
                    </span>
                  ))}
                </div>
              )}
              {s.description && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>}
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                {s.price && <span>💰 {s.price}</span>}
                {s.service_area && <span>📍 {s.service_area}</span>}
              </div>
              {s.serviceImages?.length > 0 && (
                <div className="mt-3 flex gap-2 overflow-hidden">
                  {s.serviceImages.slice(0, 3).map((img: any) => (
                    <div key={img.id} className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border">
                      <img src={serviceImageThumb(img.image_url)} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </div>
                  ))}
                  {s.serviceImages.length > 3 && (
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">+{s.serviceImages.length - 3}</span>
                  )}
                </div>
              )}
            </button>
          ))}
          {services.length === 0 && <p className="text-sm text-muted-foreground">Nenhum serviço cadastrado.</p>}
        </div>
      </div>
      {selected && (
        <ServiceDetailDialog service={selected} open={!!selected} onClose={() => setSelected(null)} whatsapp={whatsapp} ctaWhatsappText={ctaWhatsappText} accentBg={accentBg} onImageClick={onImageClick} />
      )}
    </>
  );
};

export default ProviderProfile;
