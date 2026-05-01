import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const siteUrl = 'https://precisodeum.com.br';
  const today = new Date().toISOString().split('T')[0];

  const url = new URL(req.url);
  const type = url.searchParams.get('type');
  const pageParam = parseInt(url.searchParams.get('page') || '1', 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const PAGE_SIZE = 5000; // alinhado com src/lib/sitemapBuilder.ts (SITEMAP_PAGE_SIZE)
  const sitemapBaseUrl = `${siteUrl}/sitemap`;

  // Sitemap Index — returns links to sub-sitemaps (paginados quando necessário)
  if (!type) {
    // Pré-conta volume das fontes paginadas para emitir &page=N no índice.
    // Usa HEAD count para ser barato (não baixa as linhas).
    const [providersCount, citiesCount, categoriesCount] = await Promise.all([
      supabase.from('providers').select('id', { count: 'exact', head: true })
        .eq('status', 'approved').not('slug', 'is', null),
      supabase.from('cities').select('id', { count: 'exact', head: true }),
      supabase.from('categories').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    ]);
    const pagesFor = (n: number | null) => Math.max(1, Math.ceil((n || 0) / PAGE_SIZE));
    const paginated: Record<string, number> = {
      providers: pagesFor(providersCount.count),
      cities: pagesFor(citiesCount.count),
      categories: pagesFor(categoriesCount.count),
      especialidades: pagesFor(categoriesCount.count),
    };
    const sitemaps = [
      'static', 'categories', 'especialidades', 'providers', 'cities',
      'blog', 'jobs', 'pages', 'popular', 'seo',
    ];
    const entries: string[] = [];
    for (const s of sitemaps) {
      const total = paginated[s] ?? 1;
      for (let p = 1; p <= total; p++) {
        const loc = p === 1
          ? `${sitemapBaseUrl}?type=${s}`
          : `${sitemapBaseUrl}?type=${s}&page=${p}`;
        entries.push(`  <sitemap>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>`);
      }
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</sitemapindex>`;

    return respond(xml);
  }

  // Janela de paginação para os sub-sitemaps de listagem grande.
  const offset = (page - 1) * PAGE_SIZE;
  const limit = PAGE_SIZE;

  // Sub-sitemaps by type
  let urls = '';

  if (type === 'static') {
    urls += entry(siteUrl, '/', today, 'daily', '1.0');
    urls += entry(siteUrl, '/buscar', today, 'daily', '0.8');
    urls += entry(siteUrl, '/categorias', today, 'weekly', '0.8');
    urls += entry(siteUrl, '/especialidades', today, 'weekly', '0.8');
    urls += entry(siteUrl, '/cidades', today, 'weekly', '0.8');
    urls += entry(siteUrl, '/servicos', today, 'weekly', '0.7');
    urls += entry(siteUrl, '/vagas', today, 'daily', '0.7');
    urls += entry(siteUrl, '/blog', today, 'daily', '0.7');
    urls += entry(siteUrl, '/cursos', today, 'weekly', '0.6');
    urls += entry(siteUrl, '/faq', today, 'monthly', '0.5');
    urls += entry(siteUrl, '/sobre', today, 'monthly', '0.3');
    urls += entry(siteUrl, '/como-funciona', today, 'monthly', '0.4');
    urls += entry(siteUrl, '/privacidade', today, 'yearly', '0.2');
    urls += entry(siteUrl, '/termos', today, 'yearly', '0.2');
    urls += entry(siteUrl, '/cookies', today, 'yearly', '0.2');
  }

  // ─── Quality gates (precomputado para todos os tipos que dependem) ───
  // Critérios alinhados ao linter / Padrão Ouro:
  //   1. Descrição com >= MIN_DESCRIPTION_LEN
  //   2. Sem termos proibidos
  //   3. service_area = provider.city (kill-switch)
  //   4. Provider aprovado
  const MIN_DESCRIPTION_LEN = 80;
  const NEEDS_ELIGIBILITY = ['providers', 'cities', 'categories', 'especialidades', 'seo'].includes(type || '');

  type EligibleSvc = {
    id: string; provider_id: string; description: string | null;
    service_area: string | null; category_id: string | null;
    providers: { id: string; slug: string | null; city: string | null; status: string; updated_at: string };
  };
  const eligible: EligibleSvc[] = [];
  const eligibleProviderSlugs = new Set<string>();
  const eligibleCityNames = new Set<string>();
  const eligibleCategoryIds = new Set<string>();

  if (NEEDS_ELIGIBILITY) {
    const { data: forbiddenRows } = await supabase
      .from('forbidden_service_terms')
      .select('term');
    const forbiddenTerms: string[] = (forbiddenRows || [])
      .map((r: any) => String(r.term || '').toLowerCase().trim())
      .filter(Boolean);
    const isCleanDescription = (desc: string | null | undefined): boolean => {
      if (!desc || desc.length < MIN_DESCRIPTION_LEN) return false;
      const norm = desc.toLowerCase();
      return !forbiddenTerms.some(t => t && norm.includes(t));
    };
    const { data: eligibleServices } = await supabase
      .from('services')
      .select('id, provider_id, description, service_area, category_id, providers!inner(id, slug, city, status, updated_at)')
      .is('deleted_at', null)
      .not('service_area', 'is', null)
      .neq('service_area', '')
      .eq('providers.status', 'approved')
      .range(0, 19999);
    for (const s of (eligibleServices || []) as any[]) {
      if (!isCleanDescription(s.description)) continue;
      if (!s.providers?.slug) continue;
      const pCity = (s.providers.city || '').trim().toLowerCase();
      const sArea = String(s.service_area || '').trim().toLowerCase();
      if (!pCity || !sArea || pCity !== sArea) continue;
      eligible.push(s as EligibleSvc);
      eligibleProviderSlugs.add(s.providers.slug);
      eligibleCityNames.add(pCity);
      if (s.category_id) eligibleCategoryIds.add(s.category_id);
    }
  }

  if (type === 'categories') {
    const { data } = await supabase.from('categories').select('id, slug, created_at').is('deleted_at', null).range(offset, offset + limit - 1);
    for (const cat of data || []) {
      if (!eligibleCategoryIds.has(cat.id)) continue; // gate
      urls += entry(siteUrl, `/categoria/${cat.slug}`, fmtDate(cat.created_at), 'daily', '0.9');
    }
  }

  if (type === 'especialidades') {
    const { data } = await supabase.from('categories').select('id, slug, created_at').is('deleted_at', null).range(offset, offset + limit - 1);
    for (const cat of data || []) {
      if (!eligibleCategoryIds.has(cat.id)) continue; // gate
      urls += entry(siteUrl, `/especialidades/${cat.slug}`, fmtDate(cat.created_at), 'weekly', '0.85');
    }
  }

  // (eligibility computado acima — reutilizado pelos blocos providers/cities/seo)

  if (type === 'providers') {
    const { data } = await supabase
      .from('providers')
      .select('slug, updated_at')
      .eq('status', 'approved')
      .not('slug', 'is', null)
      .range(offset, offset + limit - 1);
    for (const p of data || []) {
      if (!eligibleProviderSlugs.has(p.slug)) continue; // gate de qualidade
      urls += entry(siteUrl, `/profissional/${p.slug}`, fmtDate(p.updated_at), 'weekly', '0.7');
    }
  }

  if (type === 'cities') {
    const { data } = await supabase.from('cities').select('slug, name, created_at').range(offset, offset + limit - 1);
    for (const city of data || []) {
      const norm = String(city.name || city.slug || '').trim().toLowerCase();
      if (!eligibleCityNames.has(norm)) continue; // gate
      urls += entry(siteUrl, `/cidade/${city.slug}`, fmtDate(city.created_at), 'weekly', '0.8');
    }
  }

  if (type === 'blog') {
    const { data } = await supabase.from('blog_posts').select('slug, updated_at').eq('published', true).is('deleted_at', null);
    for (const post of data || []) {
      urls += entry(siteUrl, `/blog/${post.slug}`, fmtDate(post.updated_at), 'weekly', '0.6');
    }
  }

  if (type === 'jobs') {
    const { data } = await supabase.from('jobs').select('slug, updated_at').eq('status', 'active').eq('approval_status', 'approved').is('deleted_at', null);
    for (const job of data || []) {
      if (job.slug) urls += entry(siteUrl, `/vagas/${job.slug}`, fmtDate(job.updated_at), 'daily', '0.6');
    }
  }

  if (type === 'pages') {
    const { data } = await supabase.from('institutional_pages').select('slug, updated_at').eq('published', true);
    for (const page of data || []) {
      urls += entry(siteUrl, `/p/${page.slug}`, fmtDate(page.updated_at), 'monthly', '0.4');
    }
  }

  if (type === 'popular') {
    const { data } = await supabase.from('popular_services').select('slug, updated_at').eq('active', true);
    for (const svc of data || []) {
      urls += entry(siteUrl, `/servico-popular/${svc.slug}`, fmtDate(svc.updated_at), 'weekly', '0.6');
    }
  }

  if (type === 'seo') {
    // Apenas combinações categoria × cidade com pelo menos 1 serviço elegível.
    // Emite a rota canônica `/categoria/:slug/em/:cidade-slug` consumida por
    // CategoryCityPage. A página é noindex automático quando 0 resultados,
    // então só listamos pares com elegibilidade comprovada (gate forte).
    const [{ data: cats }, { data: cities }] = await Promise.all([
      supabase.from('categories').select('id, slug').is('deleted_at', null),
      supabase.from('cities').select('slug, name'),
    ]);
    // Indexa elegibilidade por (category_id, city normalizada)
    const eligiblePairs = new Set<string>();
    for (const s of eligible) {
      const cityNorm = (s.providers.city || '').trim().toLowerCase();
      if (s.category_id && cityNorm) eligiblePairs.add(`${s.category_id}::${cityNorm}`);
    }
    for (const cat of cats || []) {
      for (const city of cities || []) {
        const cityNorm = String(city.name || city.slug || '').trim().toLowerCase();
        if (!eligiblePairs.has(`${cat.id}::${cityNorm}`)) continue;
        // Rota canônica rica (CategoryCityPage)
        urls += entry(siteUrl, `/categoria/${cat.slug}/em/${city.slug}`, today, 'weekly', '0.65');
        // /buscar com filtros pré-aplicados — variante navegável e indexável.
        // Mesmo conteúdo, intent diferente (busca livre por categoria+cidade).
        // Prioridade ligeiramente menor para não competir com o canonical rico.
        const cityName = encodeURIComponent(String(city.name || city.slug));
        urls += entry(
          siteUrl,
          `/buscar?categoria=${cat.slug}&cidade=${cityName}`,
          today,
          'weekly',
          '0.55',
        );
      }
    }
  }

  // Categorias só entram se tiverem ao menos 1 serviço elegível.
  // (mantemos categories como sub-sitemap separado mais acima)

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}</urlset>`;

  return respond(xml);
});

function respond(xml: string) {
  return new Response(xml, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}

function fmtDate(date: string): string {
  try { return new Date(date).toISOString().split('T')[0]; }
  catch { return new Date().toISOString().split('T')[0]; }
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));
}

function entry(base: string, path: string, lastmod: string, changefreq: string, priority: string): string {
  return `  <url>
    <loc>${escapeXml(base)}${escapeXml(path)}</loc>
    <lastmod>${escapeXml(lastmod)}</lastmod>
    <changefreq>${escapeXml(changefreq)}</changefreq>
    <priority>${escapeXml(priority)}</priority>
  </url>\n`;
}
