import { useParams, Link, useNavigate } from 'react-router-dom';
import { avatarLarge, portfolioThumb, portfolioFull, coverImage, serviceImageThumb, originalUrl } from '@/lib/imageOptimizer';
import { handleImageError } from '@/lib/imageResolver';
import { MapPin, Phone, Globe, MessageCircle, Clock, ChevronRight, Crown, Copy, Instagram, Facebook, Youtube, Star, Send, X, Users, Briefcase, Image as ImageIcon } from 'lucide-react';
import { whatsappLink, telLink, toCanonical } from '@/lib/whatsapp';
import ImageLightbox from '@/components/ImageLightbox';
import { useIsMobile } from '@/hooks/use-mobile';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import StarRating from '@/components/StarRating';
import SponsorAd from '@/components/SponsorAd';
import { lazy, Suspense } from 'react';
const AdSlot = lazy(() => import('@/components/ads/AdSlot'));
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect, useMemo, useCallback } from 'react';
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
  sections_order: ['about', 'portfolio', 'services', 'reviews'],
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
  relatedProviders: any[];
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
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [leadSent, setLeadSent] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: '', phone: '', service: '', message: '' });
  const [pageSettings, setPageSettings] = useState<PageSettings>(DEFAULT_SETTINGS);
  const [relatedProviders, setRelatedProviders] = useState<any[]>([]);

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
      setRelatedProviders(snapshot.relatedProviders);
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

      let { data } = await supabase
        .from('providers')
        .select('*, categories(name, slug, icon)')
        .eq('slug', slug)
        .maybeSingle();

      if (!data && slug) {
        const sanitized = sanitizeSlug(slug);
        if (sanitized !== slug) {
          const { data: fallback } = await supabase
            .from('providers')
            .select('*, categories(name, slug, icon)')
            .eq('slug', sanitized)
            .maybeSingle();
          if (fallback) {
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
        let preparedRelated: any[] = [];

        const { data: profile } = await supabase
          .from('public_profiles' as any)
          .select('full_name, avatar_url')
          .eq('id', data.user_id)
          .maybeSingle();

        const { data: userProfile } = await supabase
          .from('profiles')
          .select('level_id, account_type_id')
          .eq('id', data.user_id)
          .maybeSingle();

        let levelInfo: any = null;
        let accTypeInfo: any = null;
        if (userProfile?.level_id) {
          const { data: lv } = await supabase.from('user_levels').select('name, color').eq('id', userProfile.level_id).single();
          levelInfo = lv;
        }
        if (userProfile?.account_type_id) {
          const { data: at } = await supabase.from('account_types').select('name, color').eq('id', userProfile.account_type_id).single();
          accTypeInfo = at;
        }

        const providerWithProfile = { ...data, profiles: profile, levelInfo, accTypeInfo };

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

         // Fetch related providers — prioritize same category, then same city
        try {
          let relatedQuery = supabase
            .from('providers')
            .select('id, slug, business_name, city, state, photo_url, rating_avg, review_count, user_id, category_id, categories(name, icon)')
            .neq('id', data.id)
            .eq('status', 'approved')
            .is('deleted_at', null)
            .order('rating_avg', { ascending: false })
            .limit(6);

          // Filter by category first (same profession)
          if (data.category_id) {
            relatedQuery = relatedQuery.eq('category_id', data.category_id);
          } else if (data.city) {
            relatedQuery = relatedQuery.eq('city', data.city);
          }

          const { data: related } = await relatedQuery;

          if (related && related.length > 0) {
            const relUserIds = related.map((r: any) => r.user_id);
            const { data: relProfiles } = await supabase
              .from('public_profiles' as any)
              .select('id, full_name, avatar_url')
              .in('id', relUserIds);
            const pMap: Record<string, any> = {};
            (relProfiles || []).forEach((p: any) => { pMap[p.id] = p; });
            preparedRelated = related.map((r: any) => ({ ...r, profiles: pMap[r.user_id] || null }));
          }
        } catch {
          // silently ignore
        }

        const snapshot: ProviderProfileSnapshot = {
          provider: providerWithProfile,
          services: preparedServices,
          reviews: preparedReviews,
          portfolioImages: preparedPortfolioImages,
          portfolioRawUrls: preparedPortfolioRawUrls,
          pageSettings: preparedPageSettings,
          relatedProviders: preparedRelated,
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
        setRelatedProviders([]);
        setLoading(false);
      }
    };

    fetchProvider();
    return () => { active = false; };
  }, [slug, navigate]);

  const name = provider ? ((provider.profiles as any)?.full_name || provider.business_name || 'Profissional') : '';
  const avatarUrl = provider ? avatarLarge((provider.profiles as any)?.avatar_url || provider.photo_url) : '';
  const category = provider ? ((provider.categories as any)?.name || '') : '';
  const categorySlug = provider ? ((provider.categories as any)?.slug || '') : '';
  const initials = name ? name.split(' ').map((n: string) => n[0]).join('').slice(0, 2) : '';
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
    toast.success('Solicitação enviada com sucesso!');
  };

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

  const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } } };
  const stagger = { visible: { transition: { staggerChildren: 0.1 } } };
  const scaleIn = { hidden: { opacity: 0, scale: 0.92 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } } };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="container py-8 space-y-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
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
  const citySlug = provider.city?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
  const visibleSections = pageSettings.sections_order.filter(s => !pageSettings.hidden_sections.includes(s));
  const tc = THEME_CLASSES[pageSettings.theme] || THEME_CLASSES.default;

  // ── Section renderers ──

  const renderAbout = () => (
    <motion.div key="about" className={`mt-6 p-6 ${tc.section}`} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }}>
      <h2 className={`${tc.heading} text-lg font-bold text-foreground`}>Sobre o profissional</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
        {provider.description || 'Este profissional ainda não adicionou uma descrição.'}
      </p>
    </motion.div>
  );

  const renderPortfolio = () => {
    if (portfolioImages.length === 0) return null;
    return (
      <motion.div key="portfolio" className={`mt-6 p-6 ${tc.section}`} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }}>
        <div className="flex items-center gap-2 mb-4">
          <ImageIcon className="h-5 w-5 text-accent" />
          <h2 className={`${tc.heading} text-lg font-bold text-foreground`}>Portfólio</h2>
          <span className="ml-auto text-xs text-muted-foreground">{portfolioImages.length} fotos</span>
        </div>
        <motion.div className="grid grid-cols-2 gap-3 sm:grid-cols-3" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          {portfolioImages.map((url, i) => (
            <motion.div
              key={i}
              variants={scaleIn}
              className="aspect-square cursor-pointer overflow-hidden rounded-xl border border-border group"
              onClick={() => openPortfolioLightbox(i)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <img src={url} alt={`Trabalho ${i + 1}`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" onError={handleImageError} />
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    );
  };

  const renderServices = () => (
    <ServicesList
      key="services"
      services={services}
      whatsapp={effectiveWhatsApp}
      providerName={name}
      providerCity={provider.city}
      ctaWhatsappText={pageSettings.cta_whatsapp_text}
      accentBg={accentBg}
      themeClasses={tc}
      onImageClick={openServiceLightbox}
    />
  );

  const renderReviews = () => {
    if (!reviewsEnabled) return null;
    return (
      <motion.div key="reviews" className={`mt-6 p-6 ${tc.section}`} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }}>
        <h2 className={`${tc.heading} text-lg font-bold text-foreground`}>Avaliações</h2>
        {reviews.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma avaliação ainda.</p>
        ) : (
          <motion.div className="mt-4 space-y-4" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            {reviews.map((r) => (
              <motion.div key={r.id} className="border-b border-border pb-4 last:border-0 last:pb-0" variants={fadeUp}>
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
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.div>
    );
  };

  const sectionMap: Record<string, () => React.ReactNode> = {
    about: renderAbout,
    portfolio: renderPortfolio,
    services: renderServices,
    reviews: renderReviews,
  };

  return (
    <div className={`flex min-h-screen flex-col ${tc.page} ${tc.fontBody}`} style={accentStyle}>
      <Header />

      {/* Cover Image Hero */}
      {pageSettings.cover_image_url && (
        <div className="relative w-full aspect-[16/5] overflow-hidden">
          <img src={coverImage(pageSettings.cover_image_url)} alt="Capa" className="h-full w-full object-cover" loading="eager" onError={handleImageError} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 container pb-6 text-white">
            {pageSettings.headline && <h2 className="font-display text-xl sm:text-3xl font-bold drop-shadow-lg">{pageSettings.headline}</h2>}
            {pageSettings.tagline && <p className="mt-1 text-sm sm:text-lg opacity-90 drop-shadow">{pageSettings.tagline}</p>}
          </div>
        </div>
      )}

      {!pageSettings.cover_image_url && (pageSettings.headline || pageSettings.tagline) && (
        <div className="container pt-6">
          {pageSettings.headline && <h2 className="font-display text-xl font-bold text-foreground">{pageSettings.headline}</h2>}
          {pageSettings.tagline && <p className="mt-1 text-sm text-muted-foreground">{pageSettings.tagline}</p>}
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

      <Suspense fallback={null}><AdSlot slotSlug="profile-top" category={category} city={provider.city} state={provider.state} /></Suspense>

      <div className="container py-6">
        <div className="mx-auto max-w-3xl">
          {/* ── Profile Header Card ── */}
          <motion.div
            className={`p-6 ${tc.card}`}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
          >
            <div className="flex flex-col items-center text-center gap-4 sm:flex-row sm:items-start sm:text-left">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
              >
                <Avatar className="h-28 w-28 shrink-0 rounded-2xl ring-4 ring-accent/20 shadow-lg">
                  <AvatarImage src={avatarUrl || undefined} alt={name} className="rounded-2xl" />
                  <AvatarFallback className="rounded-2xl bg-primary text-3xl font-bold text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </motion.div>
              <motion.div
                className="flex-1 min-w-0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25, duration: 0.5 }}
              >
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h1 className="font-display text-2xl font-bold text-foreground">{name}</h1>
                  {provider.plan === 'premium' && (
                    <motion.span
                      className={`inline-flex items-center gap-1 ${tc.badge} bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground`}
                      style={accentBg ? { backgroundColor: accentBg } : undefined}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.4, type: 'spring', stiffness: 300, damping: 15 }}
                    >
                      <Crown className="h-3 w-3" /> DESTAQUE
                    </motion.span>
                  )}
                  {provider.levelInfo && (
                    <span className={`inline-flex items-center gap-1 ${tc.badge} px-2 py-0.5 text-xs font-medium`} style={{ backgroundColor: `${provider.levelInfo.color}20`, color: provider.levelInfo.color }}>
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: provider.levelInfo.color }} />
                      {provider.levelInfo.name}
                    </span>
                  )}
                  {provider.accTypeInfo && (
                    <span className={`inline-flex items-center gap-1 ${tc.badge} border px-2 py-0.5 text-xs font-medium`} style={{ borderColor: `${provider.accTypeInfo.color}40`, color: provider.accTypeInfo.color }}>
                      {provider.accTypeInfo.name}
                    </span>
                  )}
                </div>
                {provider.business_name && <p className="text-sm text-muted-foreground mt-1">{provider.business_name}</p>}
                <p className="mt-1 text-sm font-semibold" style={accentBg ? { color: accentBg } : undefined}>
                  {category || 'Categoria não informada'}
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4 text-accent" />
                    {provider.city
                      ? `${provider.neighborhood ? `${provider.neighborhood}, ` : ''}${provider.city} - ${provider.state}`
                      : 'Localização não informada'}
                  </span>
                  {provider.years_experience > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4 text-accent" />
                      {provider.years_experience} anos exp.
                    </span>
                  )}
                </div>
                {reviewsEnabled && (
                  <div className="mt-3 flex justify-center sm:justify-start">
                    <StarRating rating={Number(provider.rating_avg)} count={provider.review_count} />
                  </div>
                )}
                {hasSocial && (
                  <div className="mt-3 flex justify-center sm:justify-start gap-2">
                    {pageSettings.instagram_url && (
                      <a href={pageSettings.instagram_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors hover:scale-110 inline-block">
                        <Instagram className="h-5 w-5" />
                      </a>
                    )}
                    {pageSettings.facebook_url && (
                      <a href={pageSettings.facebook_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors hover:scale-110 inline-block">
                        <Facebook className="h-5 w-5" />
                      </a>
                    )}
                    {pageSettings.youtube_url && (
                      <a href={pageSettings.youtube_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors hover:scale-110 inline-block">
                        <Youtube className="h-5 w-5" />
                      </a>
                    )}
                    {pageSettings.tiktok_url && (
                      <a href={pageSettings.tiktok_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors hover:scale-110 inline-block text-sm font-bold">
                        🎵
                      </a>
                    )}
                  </div>
                )}
              </motion.div>
            </div>

            {/* ── CTA Buttons ── */}
            <motion.div
              className="mt-6 flex flex-wrap justify-center sm:justify-start gap-2"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5 }}
            >
              <Button
                variant="accent"
                size="lg"
                className={`${tc.button} gap-2 shadow-lg hover:shadow-xl transition-shadow`}
                onClick={() => setLeadDialogOpen(true)}
                style={accentBg ? { backgroundColor: accentBg } : undefined}
              >
                <Send className="h-4 w-4" />
                {pageSettings.cta_text}
              </Button>
              {effectiveWhatsApp && (
                <Button variant="outline" size="lg" className={`${tc.buttonOutline} gap-2`} asChild>
                  <a href={whatsappLink(effectiveWhatsApp, `Olá! Vi seu perfil "${name}" no Preciso de um e gostaria de um orçamento.`)} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-5 w-5 text-[#25D366]" /> {pageSettings.cta_whatsapp_text}
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
              <Button variant="ghost" size="lg" onClick={() => {
                navigator.clipboard.writeText(window.location.href).then(() => toast.success('Link copiado!')).catch(() => window.prompt('Copie o link:', window.location.href));
              }}>
                <Copy className="h-4 w-4" /> Copiar Link
              </Button>
            </motion.div>
          </motion.div>

          {/* ── Dynamic sections ── */}
          {visibleSections.map((sectionId) => {
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

          {/* ── Related Providers ── */}
          {relatedProviders.length > 0 && (
            <motion.div className="mt-8" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }}>
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-accent" />
                <h2 className={`${tc.heading} text-lg font-bold text-foreground`}>Profissionais Relacionados</h2>
              </div>
              <motion.div className="grid grid-cols-2 gap-3 sm:grid-cols-3" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                {relatedProviders.map((rp: any) => {
                  const rpName = rp.profiles?.full_name || rp.business_name || 'Profissional';
                  const rpInitials = rpName.split(' ').map((n: string) => n[0]).join('').slice(0, 2);
                  const rpAvatar = avatarLarge(rp.profiles?.avatar_url || rp.photo_url);
                  const rpCategory = (rp.categories as any)?.name || '';
                  return (
                    <motion.div key={rp.id} variants={scaleIn} whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
                      <Link
                        to={`/profissional/${rp.slug}`}
                        className={`group block p-4 transition-all hover:shadow-lg hover:border-accent/30 ${tc.card}`}
                      >
                        <div className="flex flex-col items-center text-center gap-2">
                          <Avatar className="h-14 w-14 rounded-xl ring-1 ring-border group-hover:ring-accent/30 transition-all">
                            <AvatarImage src={rpAvatar || undefined} alt={rpName} className="rounded-xl" />
                            <AvatarFallback className="rounded-xl bg-primary/10 text-sm font-bold text-primary">
                              {rpInitials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{rpName}</p>
                            {rpCategory && <p className="text-[11px] text-accent truncate">{rpCategory}</p>}
                            <p className="text-[11px] text-muted-foreground truncate">
                              <MapPin className="inline h-3 w-3 mr-0.5" />{rp.city}
                            </p>
                            {rp.rating_avg > 0 && (
                              <div className="flex items-center justify-center gap-1 mt-1">
                                <Star className="h-3 w-3 fill-accent text-accent" />
                                <span className="text-[11px] font-medium text-foreground">{Number(rp.rating_avg).toFixed(1)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </motion.div>
            </motion.div>
          )}

          <Suspense fallback={null}><AdSlot slotSlug="profile-before-whatsapp" category={category} city={provider.city} state={provider.state} /></Suspense>
          <Suspense fallback={null}><AdSlot slotSlug="profile-footer" category={category} city={provider.city} state={provider.state} /></Suspense>
        </div>
      </div>

      {/* ── Lead Form Dialog (popup) ── */}
      <Dialog open={leadDialogOpen} onOpenChange={setLeadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Send className="h-5 w-5 text-accent" />
              {pageSettings.cta_text}
            </DialogTitle>
          </DialogHeader>
          {leadSent ? (
            <div className="rounded-xl bg-accent/10 p-6 text-center space-y-2">
              <div className="mx-auto h-12 w-12 rounded-full bg-accent/20 flex items-center justify-center">
                <Send className="h-6 w-6 text-accent" />
              </div>
              <p className="text-sm font-semibold text-foreground">Solicitação enviada!</p>
              <p className="text-xs text-muted-foreground">O profissional entrará em contato em breve.</p>
              <Button variant="outline" onClick={() => setLeadDialogOpen(false)} className="mt-2">Fechar</Button>
            </div>
          ) : (
            <form onSubmit={handleLeadSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Seu nome</label>
                <input type="text" placeholder="Como quer ser chamado?" required value={leadForm.name}
                  onChange={(e) => setLeadForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Telefone</label>
                <input type="tel" placeholder="(00) 00000-0000" required value={leadForm.phone}
                  onChange={(e) => setLeadForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Serviço necessário</label>
                <input type="text" placeholder="Ex: Reforma de banheiro" required value={leadForm.service}
                  onChange={(e) => setLeadForm(prev => ({ ...prev, service: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Mensagem</label>
                <textarea placeholder="Descreva o que precisa..." rows={3} value={leadForm.message}
                  onChange={(e) => setLeadForm(prev => ({ ...prev, message: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none resize-none" />
              </div>
              <Button type="submit" variant="accent" className="w-full gap-2" style={accentBg ? { backgroundColor: accentBg } : undefined}>
                <Send className="h-4 w-4" /> Enviar Solicitação
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Floating WhatsApp */}
      {effectiveWhatsApp && (
        <a
          href={whatsappLink(effectiveWhatsApp, `Olá! Vi seu perfil "${name}" no Preciso de um e gostaria de um orçamento.`)}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed right-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-110 active:scale-95"
          style={{ zIndex: 9999, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 90px)' }}
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
              className="aspect-[4/3] cursor-pointer overflow-hidden rounded-lg border border-border transition-transform hover:scale-[1.02]"
              onClick={() => onImageClick?.(service.serviceImages.map((i: any) => i.image_url), idx)}
            >
              <img src={serviceImageThumb(img.image_url)} alt="Foto do serviço" className="h-full w-full object-contain bg-muted/30" loading="lazy" onError={handleImageError} />
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
      <Button variant="accent" className="w-full gap-2" asChild style={accentBg ? { backgroundColor: accentBg } : undefined}>
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
              className="w-full text-left rounded-lg border border-border p-4 transition-all hover:border-accent/30 hover:shadow-sm group"
            >
              <div className="flex gap-3">
                {/* Service thumbnail preview */}
                {s.serviceImages?.length > 0 && (
                  <div className="shrink-0 h-20 w-20 overflow-hidden rounded-lg border border-border">
                    <img
                      src={serviceImageThumb(s.serviceImages[0].image_url)}
                      alt=""
                      className="h-full w-full object-contain bg-muted/20"
                      loading="lazy"
                      onError={handleImageError}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">{s.service_name}</h3>
                  {s.serviceCategories?.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {s.serviceCategories.map((cat: any, i: number) => (
                        <span key={i} className="inline-flex items-center gap-0.5 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                          {cat.icon} {cat.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {s.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>}
                  <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {s.price && <span className="font-medium text-foreground">💰 {s.price}</span>}
                    {s.service_area && <span>📍 {s.service_area}</span>}
                  </div>
                </div>
              </div>
              {/* Additional image thumbnails */}
              {s.serviceImages?.length > 1 && (
                <div className="mt-2 flex gap-1.5 overflow-hidden pl-[calc(5rem+0.75rem)]">
                  {s.serviceImages.slice(1, 4).map((img: any) => (
                    <div key={img.id} className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border">
                      <img src={serviceImageThumb(img.image_url)} alt="" className="h-full w-full object-contain bg-muted/20" loading="lazy" onError={handleImageError} />
                    </div>
                  ))}
                  {s.serviceImages.length > 4 && (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-medium text-muted-foreground">+{s.serviceImages.length - 4}</span>
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
