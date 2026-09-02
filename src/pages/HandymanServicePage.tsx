import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from '@/lib/router-compat';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProviderCard from '@/components/ProviderCard';
import Breadcrumbs from '@/components/Breadcrumbs';
import StarRating from '@/components/StarRating';
import { Button } from '@/components/ui/button';
import { SkeletonCardGrid } from '@/components/motion/Skeletons';
import ProgressIndicator from '@/components/motion/ProgressIndicator';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';
import { useJsonLd } from '@/hooks/useJsonLd';
import CategoryIcon from '@/components/CategoryIcon';
import { ArrowRight, ChevronDown, MapPin, MessageCircle, Quote, Search, ShieldCheck } from 'lucide-react';
import OpportunityLeadForm from '@/components/categories/OpportunityLeadForm';
import {
  HANDYMAN_CITY_SEEDS,
  HANDYMAN_LABEL,
  HANDYMAN_PRICES,
  HANDYMAN_SLUG,
  HANDYMAN_STEPS,
  HANDYMAN_TASKS,
  buildHandymanFaq,
  buildHandymanNeighborhoodSeo,
  buildHandymanSeo,
  handymanCityPath,
  handymanNeighborhoodPath,
  handymanNeighborhoodSlug,
  handymanSlugCandidates,
  humanizeSlug,
  slugifyNeighborhood,
} from '@/lib/handymanServiceContent';


interface Props {
  /** Quando true, lê o parâmetro citySlug da rota programática. */
  regional?: boolean;
}

const PROVIDER_COLUMNS =
  'id, user_id, business_name, slug, city, state, neighborhood, rating_avg, review_count, ' +
  'photo_url, description, years_experience, featured, services_count, portfolio_album_count, ' +
  'portfolio_photo_count, created_at, categories(name, slug, icon)';

const HandymanServicePage = ({ regional = false }: Props) => {
  const params = useParams<{ citySlug?: string }>();
  const citySlug = regional ? params.citySlug || '' : '';
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  /**
   * Resolve cidade (e opcionalmente bairro) do slug da rota regional.
   * "curitiba" -> cidade; "curitiba-batel" -> cidade Curitiba + bairro Batel.
   */
  const { data: place } = useQuery({
    queryKey: ['handyman-place', citySlug],
    enabled: !!citySlug,
    staleTime: 1000 * 60 * 30,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const candidates = handymanSlugCandidates(citySlug);
      const { data } = await supabase
        .from('cities')
        .select('name, state, slug')
        .in('slug', candidates);
      const rows = (data as any[] | null) || [];
      // Match mais longo vence (evita "sao" ganhar de "sao-jose-dos-pinhais").
      const match = rows.sort((a, b) => b.slug.length - a.slug.length)[0] || null;
      if (!match) {
        // Fallback por prefixo: tenta do candidato mais longo ao mais curto,
        // escolhendo o slug mais curto que casa — evita "santo" resolver "Santos".
        for (const cand of candidates.slice(0, -1)) {
          const { data: prefixed } = await supabase
            .from('cities')
            .select('name, state, slug')
            .ilike('slug', `${cand}%`)
            .order('slug', { ascending: true })
            .limit(20);
          const best = ((prefixed as any[] | null) || [])
            .sort((a, b) => a.slug.length - b.slug.length)[0];
          if (best) {
            return { city: best, neighborhoodSlug: handymanNeighborhoodSlug(citySlug, best.slug) };
          }
        }
        return { city: null, neighborhoodSlug: '' };
      }
      return { city: match, neighborhoodSlug: handymanNeighborhoodSlug(citySlug, match.slug) };
    },
  });

  const city = place?.city || null;
  const neighborhoodSlug = place?.neighborhoodSlug || '';
  const cityLabel = city?.name || (citySlug ? humanizeSlug(citySlug) : '');


  const { data: providers = [], isLoading, isPlaceholderData } = useQuery({
    queryKey: ['handyman-providers', citySlug, city?.name, neighborhoodSlug],
    staleTime: 1000 * 60 * 5,
    // Mantém a listagem anterior visível enquanto a nova rota carrega.
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data: cats } = await supabase.from('categories').select('id').eq('slug', HANDYMAN_SLUG);
      const catId = cats?.[0]?.id;
      if (!catId) return [];
      let query = supabase
        .from('providers')
        .select(PROVIDER_COLUMNS)
        .eq('category_id', catId)
        .eq('status', 'approved')
        .order('rating_avg', { ascending: false })
        // Com bairro, filtramos client-side (ilike não ignora acentos) — busca ampla primeiro.
        .limit(neighborhoodSlug ? 200 : 24);
      if (city?.name) query = query.ilike('city', `${city.name}%`);

      const { data } = await query;
      let rows = (data as any[] | null) || [];
      // Bairro: match por slug (acento-insensitivo), estrito para a landing hiperlocal.
      if (neighborhoodSlug) {
        rows = rows
          .filter((p) => slugifyNeighborhood(p.neighborhood || '') === neighborhoodSlug)
          .slice(0, 24);
      }
      if (!rows.length) return [];
      const userIds = [...new Set(rows.map((p) => p.user_id))];
      const { data: profiles } = await supabase
        .from('public_profiles' as any)
        .select('id, full_name, avatar_url')
        .in('id', userIds);
      const profileMap: Record<string, any> = {};
      (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });
      return rows.map((p: any) => {
        const profile = profileMap[p.user_id];
        const cat = p.categories as any;
        return {
          id: p.id,
          userId: p.user_id,
          name: profile?.full_name || p.business_name || 'Profissional',
          businessName: p.business_name || undefined,
          category: cat?.name || HANDYMAN_LABEL,
          categorySlug: cat?.slug || HANDYMAN_SLUG,
          categoryIcon: cat?.icon || 'Wrench',
          city: p.city,
          state: p.state,
          neighborhood: p.neighborhood,
          rating: Number(p.rating_avg) || 0,
          reviewCount: p.review_count || 0,
          photo: p.photo_url || profile?.avatar_url || '',
          description: p.description,
          yearsExperience: p.years_experience,
          slug: p.slug || p.id,
          featured: p.featured,
          servicesCount: p.services_count || 0,
          portfolioAlbumCount: p.portfolio_album_count || 0,
          portfolioPhotoCount: p.portfolio_photo_count || 0,
          createdAt: p.created_at || null,
        };
      });
    },
  });

  const providerIds = useMemo(() => providers.map((p: any) => p.id), [providers]);

  /** Prova social: avaliações reais aprovadas dos profissionais listados. */
  const { data: reviews = [] } = useQuery({
    queryKey: ['handyman-reviews', providerIds.join(',')],
    enabled: providerIds.length > 0,
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const { data } = await supabase
        .from('reviews')
        .select('id, provider_id, rating, comment, created_at, approval_status')
        .in('provider_id', providerIds)
        .eq('approval_status', 'approved')
        .not('comment', 'is', null)
        .order('created_at', { ascending: false })
        .limit(6);
      return (data as any[] | null) || [];
    },
  });

  const providerById = useMemo(() => {
    const map: Record<string, any> = {};
    providers.forEach((p: any) => { map[p.id] = p; });
    return map;
  }, [providers]);

  const localLabel = neighborhoodLabel ? `${neighborhoodLabel}, ${cityLabel}` : cityLabel;

  /** Bairros reais dos profissionais listados — alimenta a malha hiperlocal. */
  const neighborhoodLinks = useMemo(() => {
    const seen = new Map<string, { slug: string; label: string }>();
    providers.forEach((p: any) => {
      const label = (p.neighborhood || '').trim();
      if (!label || label.toLowerCase() === (cityLabel || '').toLowerCase()) return;
      const slug = label
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      if (slug && !seen.has(slug)) seen.set(slug, { slug, label });
    });
    return [...seen.values()].slice(0, 24);
  }, [providers, cityLabel]);

  const faqs = useMemo(() => buildHandymanFaq(localLabel || null), [localLabel]);
  const seo = useMemo(() => {
    if (!citySlug) return buildHandymanSeo(null, providers.length);
    const cityRef = { label: cityLabel, state: city?.state, slug: city?.slug || citySlug };
    if (neighborhoodSlug && city?.slug) {
      return buildHandymanNeighborhoodSeo(cityRef, { label: neighborhoodLabel, slug: neighborhoodSlug }, providers.length);
    }
    return buildHandymanSeo(cityRef, providers.length);
  }, [citySlug, cityLabel, city?.state, city?.slug, neighborhoodSlug, neighborhoodLabel, providers.length]);

  const canonical = `${SITE_BASE_URL}${seo.canonicalPath}`;
  // Cidade/bairro sem profissional é conteúdo raso — não indexamos.
  const noindex = !!citySlug && providers.length === 0;


  useSeoHead({ title: seo.title, description: seo.description, canonical, noindex });

  useEffect(() => {
    const el = document.querySelector('meta[name="keywords"]') as HTMLMetaElement | null;
    if (el) { el.content = seo.keywords; return; }
    const meta = document.createElement('meta');
    meta.name = 'keywords';
    meta.content = seo.keywords;
    document.head.appendChild(meta);
  }, [seo.keywords]);

  useJsonLd({
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: citySlug ? `Marido de aluguel em ${localLabel}` : HANDYMAN_LABEL,
    serviceType: HANDYMAN_LABEL,
    description: seo.description,
    areaServed: citySlug
      ? {
          '@type': neighborhoodLabel ? 'Place' : 'City',
          name: localLabel,
          address: {
            '@type': 'PostalAddress',
            ...(neighborhoodLabel ? { streetAddress: neighborhoodLabel } : {}),
            addressLocality: cityLabel,
            addressRegion: city?.state || undefined,
            addressCountry: 'BR',
          },
        }
      : { '@type': 'Country', name: 'Brasil' },

    provider: { '@type': 'Organization', name: 'Preciso de um', url: SITE_BASE_URL },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'BRL',
      lowPrice: 70,
      highPrice: 900,
      offerCount: providers.length || undefined,
    },
  }, 'json-ld-handyman-service');

  useJsonLd({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  }, 'json-ld-handyman-faq');

  useJsonLd(providers.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: seo.h1,
    itemListElement: providers.slice(0, 12).map((p: any, i: number) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'LocalBusiness',
        name: p.businessName || p.name,
        url: `${SITE_BASE_URL}/profissional/${p.slug}`,
        address: { '@type': 'PostalAddress', addressLocality: p.city || cityLabel, addressRegion: p.state || undefined, addressCountry: 'BR' },
        ...(p.reviewCount > 0 && p.rating > 0
          ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.rating, reviewCount: p.reviewCount } }
          : {}),
      },
    })),
  } : null, 'json-ld-handyman-list');

  const searchHref = citySlug
    ? `/buscar?q=marido+de+aluguel&cidade=${encodeURIComponent(cityLabel)}`
    : '/buscar?q=marido+de+aluguel';

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      {isPlaceholderData && <ProgressIndicator fixed label="Carregando profissionais" />}
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-gradient-to-br from-primary/10 via-background to-accent/10 py-12">
          <div className="container">
            <Breadcrumbs
              items={citySlug
                ? (neighborhoodLabel
                    ? [
                        { label: HANDYMAN_LABEL, url: `/servico/${HANDYMAN_SLUG}` },
                        { label: cityLabel, url: handymanCityPath(city?.slug || citySlug) },
                        { label: neighborhoodLabel },
                      ]
                    : [{ label: HANDYMAN_LABEL, url: `/servico/${HANDYMAN_SLUG}` }, { label: cityLabel }])
                : [{ label: HANDYMAN_LABEL }]}
            />
            <div className="mt-4 max-w-3xl">
              {citySlug && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  <MapPin className="h-3.5 w-3.5" /> {localLabel}{city?.state ? ` - ${city.state}` : ''}
                </span>
              )}
              <h1 className="mt-3 font-display text-3xl font-bold text-foreground md:text-4xl">{seo.h1}</h1>
              <p className="mt-3 text-muted-foreground md:text-lg">{seo.description}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild size="lg" className="rounded-full">
                  <Link to={searchHref}>
                    <Search className="mr-1 h-4 w-4" /> Ver profissionais disponíveis
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-full">
                  <a href="#contato">
                    <MessageCircle className="mr-1 h-4 w-4" /> Pedir orçamento
                  </a>
                </Button>
              </div>
              <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" /> Sem comissão da plataforma: você negocia direto com o profissional.
              </p>
            </div>
          </div>
        </section>

        {/* O que faz */}
        <section className="py-12">
          <div className="container">
            <h2 className="font-display text-2xl font-bold text-foreground">
              O que faz um marido de aluguel{citySlug ? ` em ${localLabel}` : ''}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              É o profissional de manutenção geral que resolve as pendências da casa sem precisar contratar
              um especialista para cada tarefa. Os serviços mais pedidos:
            </p>
            <div className="mt-6 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
              {HANDYMAN_TASKS.map((task) => (
                <div key={task.title} className="motion-enter rounded-2xl border border-border bg-card p-5">
                  <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <CategoryIcon icon={task.icon} size={20} className="text-primary" />
                  </span>
                  <h3 className="text-sm font-semibold text-foreground">{task.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Como funciona */}
        <section className="bg-muted/40 py-12">
          <div className="container">
            <h2 className="font-display text-2xl font-bold text-foreground">Como funciona a contratação</h2>
            <div className="mt-6 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
              {HANDYMAN_STEPS.map((step) => (
                <div key={step.title} className="rounded-2xl border border-border bg-card p-5">
                  <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Preços */}
        <section className="py-12">
          <div className="container">
            <h2 className="font-display text-2xl font-bold text-foreground">
              Quanto custa um marido de aluguel{citySlug ? ` em ${localLabel}` : ''}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Faixas médias praticadas no mercado, apenas como referência. O valor final é combinado
              diretamente com o profissional e varia conforme deslocamento, material e complexidade.
            </p>
            <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Serviço</th>
                    <th className="px-4 py-3">Faixa estimada</th>
                    <th className="px-4 py-3">Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {HANDYMAN_PRICES.map((row) => (
                    <tr key={row.service} className="border-t border-border">
                      <td className="px-4 py-3 font-medium text-foreground">{row.service}</td>
                      <td className="px-4 py-3 font-semibold text-primary">{row.range}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Profissionais */}
        <section className="bg-muted/40 py-12">
          <div className="container">
            <h2 className="font-display text-2xl font-bold text-foreground">
              Profissionais de marido de aluguel{citySlug ? ` em ${localLabel}` : ' no Brasil'}
            </h2>
            {isLoading && !isPlaceholderData ? (
              <div className="mt-6"><SkeletonCardGrid count={6} /></div>
            ) : providers.length > 0 ? (
              <>
                <div className="mt-6 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
                  {providers.slice(0, 12).map((p: any, i: number) => (
                    <ProviderCard key={p.id} provider={p as any} index={i} trackingSource="handyman_landing" />
                  ))}
                </div>
                <div className="mt-6">
                  <Button asChild variant="outline" className="rounded-full">
                    <Link to={searchHref}>Ver todos os profissionais <ArrowRight className="ml-1 h-4 w-4" /></Link>
                  </Button>
                </div>
              </>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-primary/30 bg-card p-6 text-center">
                <p className="text-sm font-semibold text-foreground">
                  Ainda não há profissionais cadastrados{citySlug ? ` em ${localLabel}` : ''}.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Deixe seu contato abaixo: avisamos assim que alguém atender a sua região — ou cadastre-se
                  se você é o profissional.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Prova social */}
        {reviews.length > 0 && (
          <section className="py-12">
            <div className="container">
              <h2 className="font-display text-2xl font-bold text-foreground">Avaliações reais de clientes</h2>
              <div className="mt-6 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
                {reviews.map((r: any) => {
                  const prov = providerById[r.provider_id];
                  return (
                    <figure key={r.id} className="rounded-2xl border border-border bg-card p-5">
                      <Quote className="h-5 w-5 text-primary/60" />
                      <blockquote className="mt-2 text-sm text-foreground">{r.comment}</blockquote>
                      <figcaption className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                          {prov ? (
                            <Link to={`/profissional/${prov.slug}`} className="font-medium text-foreground hover:text-primary">
                              {prov.businessName || prov.name}
                            </Link>
                          ) : 'Profissional avaliado'}
                          {prov?.city ? ` · ${prov.city}` : ''}
                        </span>
                        <StarRating rating={Number(r.rating) || 0} size={14} />
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* FAQ interativo */}
        <section className="bg-muted/40 py-12">
          <div className="container max-w-3xl">
            <h2 className="font-display text-2xl font-bold text-foreground">Perguntas frequentes</h2>
            <div className="mt-6 space-y-2.5">
              {faqs.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div key={faq.question} className="overflow-hidden rounded-xl border border-border bg-card">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    >
                      <span className="text-sm font-semibold text-foreground">{faq.question}</span>
                      <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <div className="grid transition-all duration-300 ease-out" style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}>
                      <div className="overflow-hidden">
                        <p className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Contato / lead */}
        <section id="contato" className="py-12">
          <div className="container max-w-3xl">
            <h2 className="font-display text-2xl font-bold text-foreground">
              Precisa de um marido de aluguel{citySlug ? ` em ${localLabel}` : ''}?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Deixe seu contato que encaminhamos para os profissionais da região — ou fale agora com quem já
              está disponível na listagem acima.
            </p>
            <div className="mt-6">
              <OpportunityLeadForm
                categorySlug={HANDYMAN_SLUG}
                categoryName={HANDYMAN_LABEL}
                city={cityLabel || null}
                categoryContextPath={seo.canonicalPath}
              />
            </div>
          </div>
        </section>

        {/* Malha interna de bairros (só na página de cidade) */}
        {!!citySlug && !neighborhoodLabel && neighborhoodLinks.length > 0 && (
          <section className="py-12">
            <div className="container">
              <h2 className="font-display text-xl font-bold text-foreground">
                Bairros atendidos em {cityLabel}
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {neighborhoodLinks.map((n) => (
                  <Link
                    key={n.slug}
                    to={handymanNeighborhoodPath(city?.slug || citySlug, n.slug)}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    {n.label}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Malha interna de cidades */}

        <section className="bg-muted/40 py-12">
          <div className="container">
            <h2 className="font-display text-xl font-bold text-foreground">Marido de aluguel por cidade</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {HANDYMAN_CITY_SEEDS.filter((c) => c.slug !== (city?.slug || citySlug)).map((c) => (
                <Link
                  key={c.slug}
                  to={handymanCityPath(c.slug)}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {c.label} - {c.state}
                </Link>
              ))}
              {citySlug && (
                <Link
                  to={`/servico/${HANDYMAN_SLUG}`}
                  className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary"
                >
                  Ver página nacional
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default HandymanServicePage;
