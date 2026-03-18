import { useParams, Link } from 'react-router-dom';
import { MapPin, Phone, Globe, MessageCircle, Clock, ChevronRight, Crown, Copy, Instagram, Facebook, Youtube } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import StarRating from '@/components/StarRating';
import SponsorAd from '@/components/SponsorAd';
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

const THEME_CLASSES: Record<string, { card: string; section: string; page: string; heading: string }> = {
  default: {
    card: 'rounded-xl border border-border bg-card shadow-card',
    section: 'rounded-xl border border-border bg-card p-6 shadow-card',
    page: '',
    heading: 'font-display',
  },
  moderno: {
    card: 'rounded-2xl border-0 bg-gradient-to-br from-card to-accent/5 shadow-lg',
    section: 'rounded-2xl border-0 bg-gradient-to-br from-card to-accent/5 p-6 shadow-lg',
    page: 'bg-gradient-to-b from-background to-accent/5',
    heading: 'font-display tracking-tight',
  },
  classico: {
    card: 'rounded-lg border-2 border-amber-200/60 bg-amber-50/30 shadow-sm',
    section: 'rounded-lg border-2 border-amber-200/60 bg-amber-50/30 p-6 shadow-sm',
    page: 'bg-amber-50/20',
    heading: 'font-serif',
  },
  minimalista: {
    card: 'rounded-none border-0 border-b border-border/30 bg-transparent shadow-none',
    section: 'rounded-none border-0 border-b border-border/30 bg-transparent p-6 shadow-none',
    page: 'bg-background',
    heading: 'font-sans font-light tracking-wide uppercase text-sm',
  },
};

const ProviderProfile = () => {
  const reviewsEnabled = useFeatureEnabled('reviews_enabled');
  const { slug } = useParams();
  const [provider, setProvider] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [portfolioImages, setPortfolioImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [leadSent, setLeadSent] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: '', phone: '', service: '', message: '' });
  const [pageSettings, setPageSettings] = useState<PageSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const fetchProvider = async () => {
      const { data } = await supabase
        .from('providers')
        .select('*, categories(name, slug, icon)')
        .eq('slug', slug)
        .maybeSingle();

      if (data) {
        const { data: profile } = await supabase
          .from('public_profiles' as any)
          .select('full_name, avatar_url')
          .eq('id', data.user_id)
          .maybeSingle();

        setProvider({ ...data, profiles: profile });

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
          setPageSettings({
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
          });
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

          setServices(svc.map((s: any) => ({
            ...s,
            serviceCategories: catMap[s.id] || [],
            serviceImages: imgMap[s.id] || [],
          })));
        } else {
          setServices([]);
        }

        if (rev && rev.length > 0) {
          const reviewUserIds = [...new Set(rev.map((r: any) => r.user_id))];
          const { data: reviewProfiles } = await supabase
            .from('public_profiles' as any)
            .select('id, full_name')
            .in('id', reviewUserIds);
          const profileMap: Record<string, string> = {};
          (reviewProfiles || []).forEach((p: any) => { profileMap[p.id] = p.full_name; });
          setReviews(rev.map((r: any) => ({ ...r, profiles: { full_name: profileMap[r.user_id] || 'Cliente' } })));
        }

        if (files) {
          setPortfolioImages(
            files
              .filter(f => f.name !== '.emptyFolderPlaceholder')
              .map(f => supabase.storage.from('portfolio').getPublicUrl(`${data.user_id}/${f.name}`).data.publicUrl)
          );
        }
      }
      setLoading(false);
    };
    fetchProvider();
  }, [slug]);

  const name = provider ? ((provider.profiles as any)?.full_name || provider.business_name || 'Profissional') : '';
  const avatarUrl = provider ? ((provider.profiles as any)?.avatar_url || provider.photo_url) : '';
  const category = provider ? ((provider.categories as any)?.name || '') : '';
  const categorySlug = provider ? ((provider.categories as any)?.slug || '') : '';
  const initials = name ? name.split(' ').map((n: string) => n[0]).join('').slice(0, 2) : '';

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
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{provider.description}</p>
    </div>
  );

  const renderPortfolio = () => {
    if (portfolioImages.length === 0) return null;
    return (
      <div key="portfolio" className={`mt-6 p-6 ${tc.section}`}>
        <h2 className={`${tc.heading} text-lg font-bold text-foreground`}>Portfólio</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {portfolioImages.map((url, i) => (
            <div key={i} className="aspect-square overflow-hidden rounded-lg border border-border">
              <img src={url} alt={`Trabalho ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderServices = () => (
    <ServicesList key="services" services={services} whatsapp={provider.whatsapp} providerName={name} providerCity={provider.city} ctaWhatsappText={pageSettings.cta_whatsapp_text} accentBg={accentBg} />
  );

  const renderReviews = () => {
    if (!reviewsEnabled) return null;
    return (
      <div key="reviews" className="mt-6 rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="font-display text-lg font-bold text-foreground">Avaliações</h2>
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
    <div key="lead_form" className="mt-6 w-full lg:hidden rounded-xl border border-border bg-card p-6 shadow-card">
      <h3 className="font-display text-lg font-bold text-foreground">{pageSettings.cta_text}</h3>
      {leadSent ? (
        <div className="mt-4 rounded-lg bg-success/10 p-4 text-center">
          <p className="text-sm font-semibold text-foreground">Solicitação enviada!</p>
          <p className="mt-1 text-xs text-muted-foreground">O profissional entrará em contato em breve.</p>
        </div>
      ) : (
        <form onSubmit={handleLeadSubmit} className="mt-4 space-y-3">
          <input type="text" placeholder="Seu nome" required value={leadForm.name}
            onChange={(e) => setLeadForm(prev => ({ ...prev, name: e.target.value }))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
          <input type="tel" placeholder="Seu telefone" required value={leadForm.phone}
            onChange={(e) => setLeadForm(prev => ({ ...prev, phone: e.target.value }))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
          <input type="text" placeholder="Serviço necessário" required value={leadForm.service}
            onChange={(e) => setLeadForm(prev => ({ ...prev, service: e.target.value }))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
          <textarea placeholder="Descreva o que precisa..." rows={3} value={leadForm.message}
            onChange={(e) => setLeadForm(prev => ({ ...prev, message: e.target.value }))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
          <Button type="submit" variant="accent" className="w-full" style={accentBg ? { backgroundColor: accentBg } : undefined}>
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
    <div className="flex min-h-screen flex-col" style={accentStyle}>
      <Header />

      {/* Cover Image Hero */}
      {pageSettings.cover_image_url && (
        <div className="relative w-full aspect-[16/5] sm:aspect-[16/5] overflow-hidden">
          <img src={pageSettings.cover_image_url} alt="Capa" className="h-full w-full object-cover" />
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

      <div className="container py-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="flex-1">
            {/* Profile header */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-card">
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
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground" style={accentBg ? { backgroundColor: accentBg } : undefined}>
                        <Crown className="h-3 w-3" /> DESTAQUE
                      </span>
                    )}
                  </div>
                  {provider.business_name && (
                    <p className="text-sm text-muted-foreground">{provider.business_name}</p>
                  )}
                  <p className="mt-1 text-sm font-medium" style={accentBg ? { color: accentBg } : undefined}>{category}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {provider.neighborhood ? `${provider.neighborhood}, ` : ''}{provider.city} - {provider.state}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {provider.years_experience} anos de experiência
                    </span>
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
                <Button variant="accent" size="lg" asChild style={accentBg ? { backgroundColor: accentBg } : undefined}>
                  <a href={`https://wa.me/${provider.whatsapp}`} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-5 w-5" /> {pageSettings.cta_whatsapp_text}
                  </a>
                </Button>
                <Button variant="outline" size="lg">
                  <Phone className="h-5 w-5" /> Ligar
                </Button>
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

            {/* Dynamic sections */}
            {visibleSections.map(sectionId => {
              const render = sectionMap[sectionId];
              return render ? render() : null;
            })}
          </div>

          {/* Sidebar */}
          <aside className="hidden lg:block w-80">
            <div className="sticky top-20 rounded-xl border border-border bg-card p-6 shadow-card">
              <h3 className="font-display text-lg font-bold text-foreground">{pageSettings.cta_text}</h3>
              {leadSent ? (
                <div className="mt-4 rounded-lg bg-success/10 p-4 text-center">
                  <p className="text-sm font-semibold text-foreground">Solicitação enviada!</p>
                  <p className="mt-1 text-xs text-muted-foreground">O profissional entrará em contato em breve.</p>
                </div>
              ) : (
                <form onSubmit={handleLeadSubmit} className="mt-4 space-y-3">
                  <input type="text" placeholder="Seu nome" required value={leadForm.name}
                    onChange={(e) => setLeadForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
                  <input type="tel" placeholder="Seu telefone" required value={leadForm.phone}
                    onChange={(e) => setLeadForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
                  <input type="text" placeholder="Serviço necessário" required value={leadForm.service}
                    onChange={(e) => setLeadForm(prev => ({ ...prev, service: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
                  <textarea placeholder="Descreva o que precisa..." rows={3} value={leadForm.message}
                    onChange={(e) => setLeadForm(prev => ({ ...prev, message: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
                  <Button type="submit" variant="accent" className="w-full" style={accentBg ? { backgroundColor: accentBg } : undefined}>
                    Enviar Solicitação
                  </Button>
                </form>
              )}
            </div>
            <SponsorAd position="sidebar" layout="vertical" className="mt-4" />
          </aside>
        </div>
      </div>
      {/* Floating WhatsApp Button */}
      <a
        href={`https://wa.me/${provider.whatsapp}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-110 lg:hidden animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]"
        aria-label="WhatsApp"
      >
        <MessageCircle className="h-7 w-7" />
      </a>
      <Footer />
    </div>
  );
};

/* ── Service Detail Dialog ── */
const ServiceDetailDialog = ({ service, open, onClose, whatsapp, ctaWhatsappText, accentBg }: { service: any; open: boolean; onClose: () => void; whatsapp: string; ctaWhatsappText?: string; accentBg?: string }) => (
  <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle className="text-lg font-bold">{service.service_name}</DialogTitle>
      </DialogHeader>
      {service.serviceImages?.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {service.serviceImages.map((img: any) => (
            <div key={img.id} className="aspect-video overflow-hidden rounded-lg border border-border">
              <img src={img.image_url} alt="Foto do serviço" className="h-full w-full object-cover" />
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
        <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="h-4 w-4" /> {ctaWhatsappText || 'Chamar no WhatsApp'}
        </a>
      </Button>
    </DialogContent>
  </Dialog>
);

/* ── Services List with popup ── */
const ServicesList = ({ services, whatsapp, providerName, providerCity, ctaWhatsappText, accentBg }: { services: any[]; whatsapp: string; providerName: string; providerCity: string; ctaWhatsappText?: string; accentBg?: string }) => {
  const [selected, setSelected] = useState<any | null>(null);

  return (
    <>
      <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="font-display text-lg font-bold text-foreground">Serviços oferecidos</h2>
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
                      <img src={img.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
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
        <ServiceDetailDialog service={selected} open={!!selected} onClose={() => setSelected(null)} whatsapp={whatsapp} ctaWhatsappText={ctaWhatsappText} accentBg={accentBg} />
      )}
    </>
  );
};

export default ProviderProfile;
