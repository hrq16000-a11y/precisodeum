import { useParams, Link } from 'react-router-dom';
import { serviceImageThumb } from '@/lib/imageOptimizer';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageCircle, MapPin, ChevronRight, Clock, Globe } from 'lucide-react';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { useJsonLd } from '@/hooks/useJsonLd';
import { useMemo } from 'react';
import { whatsappLink } from '@/lib/whatsapp';

const ServiceDetailPage = () => {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['service-detail', id],
    queryFn: async () => {
      const { data: svc } = await supabase
        .from('services')
        .select('*, categories(name, slug, icon)')
        .eq('id', id)
        .maybeSingle();
      if (!svc) return null;

      const [{ data: provider }, { data: profile }, { data: images }, { data: scats }] = await Promise.all([
        supabase.from('providers').select('*, categories(name, slug, icon)').eq('id', svc.provider_id).maybeSingle(),
        supabase.from('public_profiles' as any).select('full_name, avatar_url').eq('id', (await supabase.from('providers').select('user_id').eq('id', svc.provider_id).maybeSingle()).data?.user_id || '').maybeSingle() as any,
        supabase.from('service_images').select('*').eq('service_id', svc.id).order('display_order'),
        supabase.from('service_categories').select('category_id, categories(name, icon)').eq('service_id', svc.id),
      ]);

      return { ...svc, provider, profile, images: images || [], serviceCategories: scats || [] };
    },
    enabled: !!id,
  });

  const svc = data;
  const providerName = svc?.profile?.full_name || svc?.provider?.business_name || 'Profissional';
  const city = svc?.provider?.city || '';
  const state = svc?.provider?.state || '';
  const provSlug = svc?.provider?.slug || svc?.provider?.id || '';

  useSeoHead({
    title: svc ? `${svc.service_name} em ${city} – ${providerName}` : 'Serviço',
    description: svc ? `${svc.service_name} em ${city}-${state}. ${svc.description?.slice(0, 120)}` : '',
    canonical: id ? `${SITE_BASE_URL}/servico-detalhe/${id}` : undefined,
  });

  const ld = useMemo(() => svc ? ({
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: svc.service_name,
    description: svc.description,
    areaServed: { '@type': 'City', name: city },
    provider: {
      '@type': 'LocalBusiness',
      name: providerName,
      url: `${SITE_BASE_URL}/profissional/${provSlug}`,
    },
  }) : null, [svc, city, providerName, provSlug]);

  useJsonLd(ld);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 py-10"><div className="container"><Skeleton className="h-8 w-64 mb-4" /><Skeleton className="h-4 w-96" /></div></main>
        <Footer />
      </div>
    );
  }

  if (!svc) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 py-20 text-center"><h1 className="text-2xl font-bold text-foreground">Serviço não encontrado</h1></main>
        <Footer />
      </div>
    );
  }

  const catInfo = svc.categories as any;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <nav className="container py-3 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Início</Link>
        {catInfo?.slug && (
          <>
            <ChevronRight className="mx-1 inline h-3 w-3" />
            <Link to={`/categoria/${catInfo.slug}`} className="hover:text-foreground">{catInfo.name}</Link>
          </>
        )}
        <ChevronRight className="mx-1 inline h-3 w-3" />
        <span className="text-foreground">{svc.service_name}</span>
      </nav>

      <main className="flex-1">
        <div className="container py-6">
          <div className="flex flex-col gap-8 lg:flex-row">
            <div className="flex-1">
              <h1 className="font-display text-2xl font-bold text-foreground md:text-3xl">{svc.service_name}</h1>
              <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="h-4 w-4" /> {city} - {state}
              </p>

              {svc.serviceCategories?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {svc.serviceCategories.map((sc: any, i: number) => (
                    <span key={i} className="inline-flex items-center gap-0.5 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                      {(sc.categories as any)?.icon} {(sc.categories as any)?.name}
                    </span>
                  ))}
                </div>
              )}

              {svc.images.length > 0 && (
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {svc.images.map((img: any) => (
                    <div key={img.id} className="aspect-video overflow-hidden rounded-xl border border-border">
                      <img src={serviceImageThumb(img.image_url)} alt={svc.service_name} className="h-full w-full object-cover" loading="lazy" />
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-card">
                <h2 className="font-display text-lg font-bold text-foreground">Descrição</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{svc.description}</p>
              </div>

              <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                {svc.price && <span className="font-semibold text-foreground">💰 {svc.price}</span>}
                {svc.service_area && <span>🗺️ Atende: {svc.service_area}</span>}
                {svc.working_hours && <span><Clock className="mr-1 inline h-3.5 w-3.5" />{svc.working_hours}</span>}
              </div>
            </div>

            {/* Sidebar */}
            <aside className="w-full lg:w-80">
              <div className="sticky top-20 rounded-xl border border-border bg-card p-6 shadow-card">
                <h3 className="font-display text-base font-bold text-foreground">Profissional</h3>
                <p className="mt-1 text-sm text-muted-foreground">{providerName}</p>
                <p className="text-xs text-muted-foreground">{city} - {state}</p>

                <div className="mt-4 space-y-2">
                  <Button variant="accent" className="w-full" asChild>
                    <a href={whatsappLink(svc.provider?.whatsapp || svc.whatsapp || '', `Olá! Vi o serviço "${svc.service_name}" no Preciso de um e gostaria de mais informações.`)} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-4 w-4" /> WhatsApp
                    </a>
                  </Button>
                  <Button variant="outline" className="w-full" asChild>
                    <Link to={`/profissional/${provSlug}`}>Ver Perfil Completo</Link>
                  </Button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <a
        href={whatsappLink(svc.provider?.whatsapp || svc.whatsapp || '', `Olá! Vi o serviço "${svc.service_name}" no Preciso de um e gostaria de mais informações.`)}
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

export default ServiceDetailPage;
