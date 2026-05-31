// scripts/generate-prerender-routes.mjs
// Gera a lista de rotas para prerender estático a partir do banco real.
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
);

// Rotas estáticas sempre presentes
const STATIC_ROUTES = [
  '/',
  '/categorias',
  '/cidades',
  '/buscar',
  '/ajuda',
  '/sobre',
  '/contato',
  '/blog',
];

const slugify = (str) =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
     .toLowerCase().trim()
     .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

export async function generatePrerenderRoutes() {
  // Buscamos apenas providers ativos — categorias e cidades são DERIVADAS
  // desse mesmo dataset. Evita gerar páginas-sombra de categorias sem
  // prestador (conteúdo ralo → sinal negativo de SEO).
  const providerResult = await supabase
    .from('providers')
    .select('slug, city, categories(slug)')
    .eq('status', 'approved')
    .not('city', 'is', null)
    .limit(5000);

  if (providerResult.error) {
    console.warn(`[prerender] Aviso em providerResult:`, providerResult.error.message);
  }

  const providers = (providerResult.data ?? []).filter(p => p.slug && p.city);

  const categoriaRoutes = [...new Set(
    providers
      .map(p => p.categories?.slug)
      .filter(Boolean)
      .map(slug => `/categoria/${slug}`)
  )];

  const cidadeRoutes = [...new Set(
    providers.map(p => `/cidade/${slugify(p.city)}`)
  )];

  const paresRoutes = [...new Set(
    providers
      .filter(p => p.categories?.slug && p.city)
      .map(p => `/categoria/${p.categories.slug}/em/${slugify(p.city)}`)
  )];

  const prestadorRoutes = providers.map(p => `/profissional/${p.slug}`);

  const allRoutes = [
    ...STATIC_ROUTES,
    ...categoriaRoutes,
    ...cidadeRoutes,
    ...paresRoutes,
    ...prestadorRoutes,
  ].filter(Boolean);

  console.log('[prerender] Rotas geradas:');
  console.log(`  Estáticas:   ${STATIC_ROUTES.length}`);
  console.log(`  Categorias:  ${categoriaRoutes.length}`);
  console.log(`  Cidades:     ${cidadeRoutes.length}`);
  console.log(`  Cat×cidade:  ${paresRoutes.length}`);
  console.log(`  Prestadores: ${prestadorRoutes.length}`);
  console.log(`  TOTAL:       ${allRoutes.length}`);

  return allRoutes;
}

if (process.argv.includes('--list')) {
  const routes = await generatePrerenderRoutes();
  routes.forEach(r => console.log(r));
}
