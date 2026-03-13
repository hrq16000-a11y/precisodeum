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

  const siteUrl = 'https://precisodeum.lovable.app';

  const [{ data: categories }, { data: cities }, { data: providers }] = await Promise.all([
    supabase.from('categories').select('slug'),
    supabase.from('cities').select('slug'),
    supabase.from('providers').select('slug').eq('status', 'approved').not('slug', 'is', null),
  ]);

  let urls = `  <url><loc>${siteUrl}/</loc><priority>1.0</priority></url>\n`;
  urls += `  <url><loc>${siteUrl}/buscar</loc><priority>0.8</priority></url>\n`;
  urls += `  <url><loc>${siteUrl}/sobre</loc><priority>0.5</priority></url>\n`;

  for (const cat of categories || []) {
    urls += `  <url><loc>${siteUrl}/categoria/${cat.slug}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
  }

  for (const city of cities || []) {
    urls += `  <url><loc>${siteUrl}/cidade/${city.slug}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>\n`;
  }

  for (const cat of categories || []) {
    for (const city of cities || []) {
      urls += `  <url><loc>${siteUrl}/${cat.slug}-${city.slug}</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>\n`;
    }
  }

  for (const p of providers || []) {
    urls += `  <url><loc>${siteUrl}/profissional/${p.slug}</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>\n`;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}</urlset>`;

  return new Response(xml, {
    headers: { ...corsHeaders, 'Content-Type': 'application/xml' },
  });
});
