import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function autoSlug(t: string) {
  return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function parseRSSItems(xml: string): Array<{ title: string; link: string; description: string; pubDate?: string }> {
  const items: Array<{ title: string; link: string; description: string; pubDate?: string }> = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return (m?.[1] || m?.[2] || '').trim();
    };
    const title = get('title');
    const link = get('link');
    const description = get('description');
    const pubDate = get('pubDate');
    if (title && link) {
      items.push({ title, link, description, pubDate });
    }
  }
  return items;
}

// Also handle Atom feeds
function parseAtomItems(xml: string): Array<{ title: string; link: string; description: string; pubDate?: string }> {
  const items: Array<{ title: string; link: string; description: string; pubDate?: string }> = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
  let match;
  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return (m?.[1] || m?.[2] || '').trim();
    };
    const title = get('title');
    const linkMatch = block.match(/<link[^>]*href="([^"]*)"[^>]*\/?>|<link[^>]*>([^<]*)<\/link>/i);
    const link = linkMatch?.[1] || linkMatch?.[2] || '';
    const description = get('summary') || get('content');
    const pubDate = get('published') || get('updated');
    if (title && link) {
      items.push({ title, link, description, pubDate });
    }
  }
  return items;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { feed_url, max_items = 10 } = await req.json();
    
    if (!feed_url) {
      return new Response(JSON.stringify({ error: 'feed_url is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resp = await fetch(feed_url, {
      headers: { 'User-Agent': 'PrecisodeumBot/1.0' },
    });

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `Failed to fetch feed: ${resp.status}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const xml = await resp.text();
    
    let items = parseRSSItems(xml);
    if (items.length === 0) {
      items = parseAtomItems(xml);
    }

    const limited = items.slice(0, max_items);

    // Import into blog_posts
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    let imported = 0;
    let skipped = 0;

    for (const item of limited) {
      const slug = autoSlug(item.title).slice(0, 100);
      
      // Check if slug already exists
      const checkResp = await fetch(`${SUPABASE_URL}/rest/v1/blog_posts?slug=eq.${encodeURIComponent(slug)}&select=id`, {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });
      const existing = await checkResp.json();
      if (existing && existing.length > 0) {
        skipped++;
        continue;
      }

      // Strip HTML from description
      const cleanDesc = item.description.replace(/<[^>]*>/g, '').slice(0, 300);

      const insertResp = await fetch(`${SUPABASE_URL}/rest/v1/blog_posts`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          title: item.title,
          slug,
          excerpt: cleanDesc,
          content: item.description || cleanDesc,
          source_url: item.link,
          published: true,
          featured: false,
          author_name: 'Fonte Externa',
        }),
      });

      if (insertResp.ok) {
        imported++;
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      total_found: items.length,
      imported, 
      skipped,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
