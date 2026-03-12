import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProviderCard from '@/components/ProviderCard';
import SearchBar from '@/components/SearchBar';
import { supabase } from '@/integrations/supabase/client';
import { providers as mockProviders, categories as mockCategories } from '@/data/mockData';

// Parse slug like "eletricista-curitiba" or "encanador-sao-paulo"
const parseSeoSlug = (slug: string) => {
  const categoryMap: Record<string, string> = {};
  mockCategories.forEach(c => { categoryMap[c.slug] = c.name; });

  // Try matching category slugs from longest to shortest
  const categorySlugs = Object.keys(categoryMap).sort((a, b) => b.length - a.length);
  for (const catSlug of categorySlugs) {
    if (slug.startsWith(catSlug + '-')) {
      const cityPart = slug.slice(catSlug.length + 1);
      const city = cityPart.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      return { categorySlug: catSlug, categoryName: categoryMap[catSlug], city };
    }
    if (slug === catSlug) {
      return { categorySlug: catSlug, categoryName: categoryMap[catSlug], city: '' };
    }
  }
  return null;
};

const SeoPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [dbProviders, setDbProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const parsed = slug ? parseSeoSlug(slug) : null;

  useEffect(() => {
    if (!parsed) { setLoading(false); return; }
    
    const fetchProviders = async () => {
      let query = supabase
        .from('providers')
        .select('*, categories(name, slug, icon)')
        .eq('status', 'approved');

      if (parsed.categorySlug) {
        const { data: cat } = await supabase.from('categories').select('id').eq('slug', parsed.categorySlug).single();
        if (cat) query = query.eq('category_id', cat.id);
      }
      if (parsed.city) {
        query = query.ilike('city', `%${parsed.city}%`);
      }

      const { data } = await query.order('rating_avg', { ascending: false });
      setDbProviders(data || []);
      setLoading(false);
    };

    fetchProviders();
  }, [slug]);

  // Fallback to mock data if no DB results
  const fallbackProviders = parsed ? mockProviders.filter(p => {
    const matchCat = !parsed.categorySlug || p.categorySlug === parsed.categorySlug;
    const matchCity = !parsed.city || p.city.toLowerCase().includes(parsed.city.toLowerCase());
    return matchCat && matchCity;
  }) : [];

  if (!parsed) {
    // Not a valid SEO slug, show 404-like
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="container flex flex-1 items-center justify-center py-20">
          <div className="text-center">
            <h1 className="font-display text-4xl font-bold text-foreground">Página não encontrada</h1>
            <p className="mt-2 text-muted-foreground">A página que você procura não existe.</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const title = parsed.city
    ? `${parsed.categoryName} em ${parsed.city}`
    : parsed.categoryName;

  const description = parsed.city
    ? `Encontre os melhores profissionais de ${parsed.categoryName} em ${parsed.city}. Veja avaliações, compare preços e entre em contato.`
    : `Encontre os melhores profissionais de ${parsed.categoryName}. Veja avaliações, compare preços e entre em contato.`;

  const displayProviders = dbProviders.length > 0
    ? dbProviders.map(p => ({
        id: p.id,
        name: (p as any).profiles?.full_name || p.business_name || 'Profissional',
        category: (p.categories as any)?.name || parsed.categoryName,
        categorySlug: (p.categories as any)?.slug || parsed.categorySlug,
        city: p.city,
        state: p.state,
        neighborhood: p.neighborhood,
        rating: Number(p.rating_avg),
        reviewCount: p.review_count,
        photo: p.photo_url || '',
        slug: p.slug || p.id,
        description: p.description,
        phone: p.phone,
        whatsapp: p.whatsapp,
        yearsExperience: p.years_experience,
        plan: p.plan as any,
        featured: p.featured,
        services: [],
        reviews: [],
        businessName: p.business_name,
      }))
    : fallbackProviders;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      {/* SEO Hero */}
      <section className="bg-hero py-12">
        <div className="container text-center">
          <h1 className="font-display text-3xl font-bold text-primary-foreground md:text-4xl">
            {title}
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-primary-foreground/70">{description}</p>
          <div className="mx-auto mt-6 max-w-2xl">
            <SearchBar variant="compact" />
          </div>
        </div>
      </section>

      <div className="container py-8">
        {loading ? (
          <p className="text-center text-muted-foreground">Carregando...</p>
        ) : (
          <>
            <p className="mb-6 text-sm text-muted-foreground">
              {displayProviders.length} profissional(is) encontrado(s)
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {displayProviders.map(p => (
                <ProviderCard key={p.id} provider={p} />
              ))}
            </div>
            {displayProviders.length === 0 && (
              <div className="rounded-xl border border-border bg-card p-12 text-center shadow-card">
                <p className="text-lg font-semibold text-foreground">Nenhum profissional encontrado</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Ainda não temos profissionais cadastrados para esta busca. Seja o primeiro!
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* SEO Content */}
      <section className="bg-muted/50 py-12">
        <div className="container max-w-3xl">
          <h2 className="font-display text-xl font-bold text-foreground">
            Encontre {parsed.categoryName}{parsed.city ? ` em ${parsed.city}` : ''}
          </h2>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Precisa de um {parsed.categoryName?.toLowerCase()}? Nossa plataforma conecta você com profissionais
              qualificados{parsed.city ? ` em ${parsed.city}` : ' em todo o Brasil'}.
              Todos os profissionais são avaliados por clientes reais.
            </p>
            <p>
              Compare avaliações, veja os serviços oferecidos e entre em contato diretamente pelo WhatsApp.
              Solicite um orçamento gratuito e encontre o profissional ideal para o seu projeto.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default SeoPage;
