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

  const [
    { data: categories },
    { data: cities },
    { data: providers },
    { data: services },
    { data: blogPosts },
    { data: jobs },
    { data: institutionalPages },
    { data: popularServices },
  ] = await Promise.all([
    supabase.from('categories').select('slug, created_at').is('deleted_at', null),
    supabase.from('cities').select('slug, created_at'),
    supabase.from('providers').select('slug, updated_at').eq('status', 'approved').not('slug', 'is', null),
    supabase.from('services').select('id, created_at, provider_id').is('deleted_at', null),
    supabase.from('blog_posts').select('slug, updated_at').eq('published', true).is('deleted_at', null),
    supabase.from('jobs').select('slug, updated_at').eq('status', 'active').eq('approval_status', 'approved').is('deleted_at', null),
    supabase.from('institutional_pages').select('slug, updated_at').eq('published', true),
    supabase.from('popular_services').select('slug, updated_at').eq('active', true),
  ]);

  let urls = '';

  // 1. Homepage
  urls += url(siteUrl, '/', today, 'daily', '1.0');

  // 2. Static pages
  urls += url(siteUrl, '/buscar', today, 'daily', '0.8');
  urls += url(siteUrl, '/categorias', today, 'weekly', '0.8');
  urls += url(siteUrl, '/cidades', today, 'weekly', '0.8');
  urls += url(siteUrl, '/servicos', today, 'weekly', '0.7');
  urls += url(siteUrl, '/vagas', today, 'daily', '0.7');
  urls += url(siteUrl, '/blog', today, 'daily', '0.7');
  urls += url(siteUrl, '/faq', today, 'monthly', '0.5');
  urls += url(siteUrl, '/sobre', today, 'monthly', '0.3');
  urls += url(siteUrl, '/privacidade', today, 'yearly', '0.2');
  urls += url(siteUrl, '/termos', today, 'yearly', '0.2');
  urls += url(siteUrl, '/cookies', today, 'yearly', '0.2');

  // 3. Categories
  for (const cat of categories || []) {
    urls += url(siteUrl, `/categoria/${cat.slug}`, lastmod(cat.created_at), 'daily', '0.9');
  }

  // 4. Providers
  for (const p of providers || []) {
    urls += url(siteUrl, `/profissional/${p.slug}`, lastmod(p.updated_at), 'weekly', '0.7');
  }

  // 5. Cities
  for (const city of cities || []) {
    urls += url(siteUrl, `/cidade/${city.slug}`, lastmod(city.created_at), 'weekly', '0.8');
  }

  // 6. Blog posts
  for (const post of blogPosts || []) {
    urls += url(siteUrl, `/blog/${post.slug}`, lastmod(post.updated_at), 'weekly', '0.6');
  }

  // 7. Jobs
  for (const job of jobs || []) {
    if (job.slug) {
      urls += url(siteUrl, `/vagas/${job.slug}`, lastmod(job.updated_at), 'daily', '0.6');
    }
  }

  // 8. Institutional pages
  for (const page of institutionalPages || []) {
    urls += url(siteUrl, `/p/${page.slug}`, lastmod(page.updated_at), 'monthly', '0.4');
  }

  // 9. Popular services
  for (const svc of popularServices || []) {
    urls += url(siteUrl, `/servico-popular/${svc.slug}`, lastmod(svc.updated_at), 'weekly', '0.6');
  }

  // 10. SEO programmatic pages: category + city
  for (const cat of categories || []) {
    for (const city of cities || []) {
      urls += url(siteUrl, `/${cat.slug}-${city.slug}`, today, 'weekly', '0.6');
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}</urlset>`;

  return new Response(xml, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
});

function lastmod(date: string): string {
  try {
    return new Date(date).toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));
}

function url(base: string, path: string, lastmod: string, changefreq: string, priority: string): string {
  return `  <url>
    <loc>${escapeXml(base)}${escapeXml(path)}</loc>
    <lastmod>${escapeXml(lastmod)}</lastmod>
    <changefreq>${escapeXml(changefreq)}</changefreq>
    <priority>${escapeXml(priority)}</priority>
  </url>\n`;
}
