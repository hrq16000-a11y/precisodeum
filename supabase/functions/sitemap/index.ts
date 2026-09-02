import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Cidades-semente das landings programáticas /marido-de-aluguel-{cidade}. */
const HANDYMAN_CITY_SLUGS = [
  'sao-paulo', 'rio-de-janeiro', 'belo-horizonte', 'brasilia', 'curitiba',
  'porto-alegre', 'salvador', 'recife', 'fortaleza', 'goiania', 'campinas',
  'manaus', 'belem', 'florianopolis', 'sao-jose-dos-pinhais',
];

/** Verticais programáticas /servico/{slug}[/{cidade[-bairro]}]. */
const SERVICE_VERTICALS: { slug: string; categorySlugs: string[] }[] = [
  { slug: 'pintor', categorySlugs: ['pintor'] },
  { slug: 'eletricista', categorySlugs: ['eletricista', 'eletricista-residencial'] },
  { slug: 'encanador', categorySlugs: ['encanador'] },
];

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
      'static', 'categories', 'especialidades', 'providers', 'companies', 'cities',
      'neighborhoods', 'services',
      'blog', 'jobs', 'pages', 'popular', 'seo', 'seo-cep',
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

    return respond(xml, req);
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
    // Landing editorial "marido de aluguel" + variações programáticas por cidade.
    urls += entry(siteUrl, '/servico/marido-de-aluguel', today, 'weekly', '0.9');
    for (const slug of HANDYMAN_CITY_SLUGS) {
      urls += entry(siteUrl, `/marido-de-aluguel-${slug}`, today, 'weekly', '0.8');
    }
  }

  // ─── Quality gates (precomputado para todos os tipos que dependem) ───
  // Critérios alinhados ao linter / Padrão Ouro:
  //   1. Descrição com >= MIN_DESCRIPTION_LEN
  //   2. Sem termos proibidos
  //   3. service_area = provider.city (kill-switch)
  //   4. Provider aprovado
  const MIN_DESCRIPTION_LEN = 80;
  const NEEDS_ELIGIBILITY = ['providers', 'cities', 'categories', 'especialidades', 'seo', 'seo-cep'].includes(type || '');

  type EligibleSvc = {
    id: string; provider_id: string; description: string | null;
    service_area: string | null; category_id: string | null;
    providers: { id: string; slug: string | null; city: string | null; status: string; updated_at: string; postal_code: string | null };
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
    // Cobertura ampliada: aceitar service_area declarada OU fallback para
    // provider.city (provider aprovado e com cidade válida já é sinal suficiente
    // de elegibilidade para o par categoria×cidade aparecer no sitemap).
    const { data: eligibleServices } = await supabase
      .from('services')
      .select('id, provider_id, description, service_area, category_id, providers!inner(id, slug, city, status, updated_at, postal_code)')
      .is('deleted_at', null)
      .eq('providers.status', 'approved')
      .range(0, 19999);
    for (const s of (eligibleServices || []) as any[]) {
      if (!isCleanDescription(s.description)) continue;
      if (!s.providers?.slug) continue;
      const pCity = (s.providers.city || '').trim().toLowerCase();
      const sArea = String(s.service_area || '').trim().toLowerCase();
      if (!pCity) continue;
      // Se service_area declarada, exige bater com cidade-base (anti-spam).
      // Sem service_area, usa provider.city (cobertura mais ampla).
      if (sArea && sArea !== pCity) continue;
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

  if (type === 'companies') {
    const { data } = await supabase
      .from('providers')
      .select('slug, updated_at, account_type')
      .eq('status', 'approved')
      .eq('account_type', 'company')
      .not('slug', 'is', null)
      .range(offset, offset + limit - 1);
    for (const p of data || []) {
      urls += entry(siteUrl, `/empresa/${p.slug}`, fmtDate(p.updated_at), 'weekly', '0.7');
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

  if (type === 'neighborhoods') {
    // Sub-sitemap de landings /cidade/:citySlug/bairro/:neighborhoodSlug.
    // Anti-thin gate (memória Core): mínimo 2 providers aprovados por par
    // (cidade × bairro). Sem gate, geraria milhares de URLs quase-vazias.
    const { data: rows } = await supabase
      .from('providers')
      .select('city, neighborhood')
      .eq('status', 'approved')
      .not('city', 'is', null)
      .not('neighborhood', 'is', null);
    const { data: citiesData } = await supabase.from('cities').select('slug, name');
    const normalize = (value: string) => String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const citySlugByNorm = new Map<string, string>();
    for (const c of citiesData || []) {
      const norm = normalize(c.name || c.slug || '');
      if (norm) citySlugByNorm.set(norm, c.slug);
    }
    const slugify = (s: string) =>
      s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
       .toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const pairCounts = new Map<string, number>(); // `citySlug::hoodSlug`
    for (const row of rows || []) {
      const cityNorm = normalize(row.city || '');
      const citySlug = citySlugByNorm.get(cityNorm);
      if (!citySlug) continue;
      const hood = String(row.neighborhood || '').trim();
      if (!hood || hood.length < 3) continue;
      const hoodSlug = slugify(hood);
      if (!hoodSlug || hoodSlug === citySlug) continue;
      const key = `${citySlug}::${hoodSlug}`;
      pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
    }
    const MIN_PROVIDERS = 2; // alinhado com SEO_ROUTE_REGISTRY.neighborhood.minProviders
    for (const [key, count] of pairCounts) {
      if (count < MIN_PROVIDERS) continue;
      const [citySlug, hoodSlug] = key.split('::');
      urls += entry(
        siteUrl,
        `/cidade/${citySlug}/bairro/${hoodSlug}`,
        today,
        'monthly',
        '0.5',
      );
    }
  }

  if (type === 'services') {
    // Landings programáticas por vertical: nacional, cidade e bairro.
    // Gate anti-thin: cidade precisa de >= 1 provider aprovado; bairro, >= 2.
    const allCatSlugs = SERVICE_VERTICALS.flatMap((v) => v.categorySlugs);
    const [{ data: cats }, { data: citiesData }] = await Promise.all([
      supabase.from('categories').select('id, slug').in('slug', allCatSlugs),
      supabase.from('cities').select('slug, name'),
    ]);
    const catIdToSlug = new Map<string, string>();
    for (const c of cats || []) catIdToSlug.set(c.id, c.slug);

    const normalizeTxt = (value: string) =>
      String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const slugifyTxt = (value: string) =>
      normalizeTxt(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const citySlugByNormName = new Map<string, string>();
    for (const c of citiesData || []) {
      const norm = normalizeTxt(c.name || c.slug || '');
      if (norm) citySlugByNormName.set(norm, c.slug);
    }

    const { data: provRows } = await supabase
      .from('providers')
      .select('category_id, city, neighborhood')
      .eq('status', 'approved')
      .in('category_id', [...catIdToSlug.keys()])
      .not('city', 'is', null);

    const cityCounts = new Map<string, number>(); // `vertical::citySlug`
    const hoodCounts = new Map<string, number>(); // `vertical::citySlug::hoodSlug`
    for (const row of (provRows || []) as any[]) {
      const catSlug = catIdToSlug.get(row.category_id);
      if (!catSlug) continue;
      const vertical = SERVICE_VERTICALS.find((v) => v.categorySlugs.includes(catSlug));
      if (!vertical) continue;
      const citySlug = citySlugByNormName.get(normalizeTxt(row.city || ''));
      if (!citySlug) continue;
      const cityKey = `${vertical.slug}::${citySlug}`;
      cityCounts.set(cityKey, (cityCounts.get(cityKey) || 0) + 1);
      const hood = String(row.neighborhood || '').trim();
      if (!hood || hood.length < 3) continue;
      const hoodSlug = slugifyTxt(hood);
      if (!hoodSlug || hoodSlug === citySlug) continue;
      const hoodKey = `${cityKey}::${hoodSlug}`;
      hoodCounts.set(hoodKey, (hoodCounts.get(hoodKey) || 0) + 1);
    }

    for (const vertical of SERVICE_VERTICALS) {
      urls += entry(siteUrl, `/servico/${vertical.slug}`, today, 'weekly', '0.9');
    }
    for (const [key] of cityCounts) {
      const [verticalSlug, citySlug] = key.split('::');
      urls += entry(siteUrl, `/servico/${verticalSlug}/${citySlug}`, today, 'weekly', '0.8');
    }
    const MIN_HOOD_PROVIDERS = 2;
    for (const [key, count] of hoodCounts) {
      if (count < MIN_HOOD_PROVIDERS) continue;
      const [verticalSlug, citySlug, hoodSlug] = key.split('::');
      urls += entry(siteUrl, `/servico/${verticalSlug}/${citySlug}-${hoodSlug}`, today, 'monthly', '0.6');
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
    // Combinações categoria × cidade. Duas fontes de elegibilidade:
    //   1) Match primário: provider.city é a cidade do par (já em `eligible`).
    //   2) Match secundário: service_area declarada referencia outra cidade
    //      conhecida (cobre região metropolitana sem afrouxar quality gates,
    //      pois o serviço já passou no filtro de descrição limpa).
    const [{ data: cats }, { data: cities }] = await Promise.all([
      supabase.from('categories').select('id, slug').is('deleted_at', null),
      supabase.from('cities').select('slug, name'),
    ]);

    // Indexa cidades conhecidas por nome normalizado para lookup do service_area.
    const citySlugByName = new Map<string, string>();
    for (const c of cities || []) {
      const norm = String(c.name || c.slug || '').trim().toLowerCase();
      if (norm) citySlugByName.set(norm, c.slug);
    }
    const splitAreaTokens = (raw: string): string[] => {
      // service_area pode vir como "Cidade A, Cidade B" ou "Cidade A | Cidade B".
      return raw
        .split(/[,;|/]/)
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length >= 3);
    };

    const eligiblePairs = new Set<string>(); // `${categoryId}::${cityNameNorm}`
    for (const s of eligible) {
      if (!s.category_id) continue;
      const baseCity = (s.providers.city || '').trim().toLowerCase();
      if (baseCity) eligiblePairs.add(`${s.category_id}::${baseCity}`);
      // Expansão via service_area (apenas tokens que batem com cidade conhecida).
      const area = String(s.service_area || '').trim();
      if (area) {
        for (const token of splitAreaTokens(area)) {
          if (token === baseCity) continue;
          if (citySlugByName.has(token)) {
            eligiblePairs.add(`${s.category_id}::${token}`);
          }
        }
      }
    }

    for (const cat of cats || []) {
      for (const city of cities || []) {
        const cityNorm = String(city.name || city.slug || '').trim().toLowerCase();
        if (!eligiblePairs.has(`${cat.id}::${cityNorm}`)) continue;
        urls += entry(siteUrl, `/categoria/${cat.slug}/em/${city.slug}`, today, 'weekly', '0.65');
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

  if (type === 'seo-cep') {
    // SEO por CEP — combinações categoria × CEP normalizado.
    // Critério de elegibilidade:
    //   - provider aprovado, descrição limpa, service_area = city (já garantido em `eligible`)
    //   - postal_code com 8 dígitos válidos
    //   - pelo menos 1 serviço elegível para o par (category_id, cep8)
    // Cada par emite a rota /buscar?categoria=:slug&cep=00000-000 (canonical da
    // própria SearchPage faz o resto).
    const { data: cats } = await supabase
      .from('categories').select('id, slug').is('deleted_at', null);
    const catSlugById = new Map<string, string>();
    for (const c of cats || []) catSlugById.set(c.id, c.slug);

    const eligiblePairs = new Set<string>(); // key: `${categorySlug}::${cepFormatted}`
    for (const s of eligible) {
      if (!s.category_id) continue;
      const slug = catSlugById.get(s.category_id);
      if (!slug) continue;
      const digits = String(s.providers.postal_code || '').replace(/\D+/g, '');
      if (digits.length !== 8 || digits === '00000000' || digits === '99999999') continue;
      const cepFmt = `${digits.slice(0, 5)}-${digits.slice(5)}`;
      eligiblePairs.add(`${slug}::${cepFmt}`);
    }
    for (const key of eligiblePairs) {
      const [slug, cepFmt] = key.split('::');
      urls += entry(
        siteUrl,
        `/buscar?categoria=${slug}&cep=${cepFmt}`,
        today,
        'weekly',
        '0.6',
      );
    }
  }

  // Categorias só entram se tiverem ao menos 1 serviço elegível.
  // (mantemos categories como sub-sitemap separado mais acima)

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}</urlset>`;

  return respond(xml, req);
});

/**
 * Revalidação incremental: ETag derivado do conteúdo + stale-while-revalidate.
 * Espelha src/lib/seo/seoCache.ts (contentHash/computeEtag/buildSeoCacheHeaders).
 */
function contentHash(content: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

const TTL_SECONDS = 3600;
const SWR_SECONDS = TTL_SECONDS * 6;

function respond(xml: string, req?: Request) {
  const etag = `"${contentHash(xml)}-${xml.length.toString(16)}"`;
  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/xml',
    'Cache-Control': `public, max-age=300, s-maxage=${TTL_SECONDS}, stale-while-revalidate=${SWR_SECONDS}`,
    ETag: etag,
  };

  const ifNoneMatch = req?.headers.get('if-none-match');
  const matches = (ifNoneMatch || '')
    .split(',')
    .map((t) => t.trim().replace(/^W\//, ''))
    .includes(etag);
  if (matches) return new Response(null, { status: 304, headers });

  return new Response(xml, { headers });
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
