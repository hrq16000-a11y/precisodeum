import { useParams, Link } from 'react-router-dom';
import { MapPin, Phone, Globe, MessageCircle, Clock, ChevronRight, Crown, Copy } from 'lucide-react';
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

  useEffect(() => {
    const fetchProvider = async () => {
      const { data } = await supabase
        .from('providers')
        .select('*, categories(name, slug, icon)')
        .eq('slug', slug)
        .maybeSingle();

      if (data) {
        // Fetch profile separately (no FK between providers and profiles)
        const { data: profile } = await supabase
          .from('public_profiles' as any)
          .select('full_name, avatar_url')
          .eq('id', data.user_id)
          .maybeSingle();

        setProvider({ ...data, profiles: profile });

        const [{ data: svc }, { data: rev }, { data: files }] = await Promise.all([
          supabase.from('services').select('*').eq('provider_id', data.id),
          supabase.from('reviews')
            .select('*, user_id')
            .eq('provider_id', data.id)
            .order('created_at', { ascending: false }),
          supabase.storage.from('portfolio').list(`${data.user_id}`, { limit: 20 }),
        ]);

        if (svc && svc.length > 0) {
          // Fetch categories and images for each service
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

/* ── Service Detail Dialog ── */
const ServiceDetailDialog = ({ service, open, onClose, whatsapp }: { service: any; open: boolean; onClose: () => void; whatsapp: string }) => (
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

      <Button variant="accent" className="w-full" asChild>
        <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="h-4 w-4" /> Chamar no WhatsApp
        </a>
      </Button>
    </DialogContent>
  </Dialog>
);

/* ── Services List with popup ── */
const ServicesList = ({ services, whatsapp, providerName, providerCity }: { services: any[]; whatsapp: string; providerName: string; providerCity: string }) => {
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
        <ServiceDetailDialog service={selected} open={!!selected} onClose={() => setSelected(null)} whatsapp={whatsapp} />
      )}
    </>
  );
};


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

  // Build city slug for breadcrumb
  const citySlug = provider.city?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

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
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
                        <Crown className="h-3 w-3" /> DESTAQUE
                      </span>
                    )}
                  </div>
                  {provider.business_name && (
                    <p className="text-sm text-muted-foreground">{provider.business_name}</p>
                  )}
                  <p className="mt-1 text-sm font-medium text-accent">{category}</p>
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
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="accent" size="lg" asChild>
                  <a href={`https://wa.me/${provider.whatsapp}`} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-5 w-5" /> Chamar no WhatsApp
                  </a>
                </Button>
                <Button variant="outline" size="lg">
                  <Phone className="h-5 w-5" /> Ligar
                </Button>
                <Button variant="outline" size="lg" onClick={() => {
                  navigator.clipboard.writeText(window.location.href).then(() => {
                    toast.success('Link copiado!');
                  }).catch(() => {
                    // fallback: prompt
                    window.prompt('Copie o link:', window.location.href);
                  });
                }}>
                  <Copy className="h-4 w-4" /> Copiar Link
                </Button>
              </div>
            </div>

            {/* About */}
            <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-card">
              <h2 className="font-display text-lg font-bold text-foreground">Sobre o profissional</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{provider.description}</p>
            </div>

            {/* Portfolio */}
            {portfolioImages.length > 0 && (
              <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-card">
                <h2 className="font-display text-lg font-bold text-foreground">Portfólio</h2>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {portfolioImages.map((url, i) => (
                    <div key={i} className="aspect-square overflow-hidden rounded-lg border border-border">
                      <img src={url} alt={`Trabalho ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Services */}
            <ServicesList services={services} whatsapp={provider.whatsapp} providerName={name} providerCity={provider.city} />

            {/* Reviews */}
            {reviewsEnabled && (
              <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-card">
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
            )}
          </div>

          {/* Sidebar */}
          <aside className="w-full lg:w-80">
            <div className="sticky top-20 rounded-xl border border-border bg-card p-6 shadow-card">
              <h3 className="font-display text-lg font-bold text-foreground">Solicitar Orçamento</h3>
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
                  <Button type="submit" variant="accent" className="w-full">Enviar Solicitação</Button>
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

export default ProviderProfile;
