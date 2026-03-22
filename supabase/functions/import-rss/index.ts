import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BOT_UA = "Mozilla/5.0 (compatible; PrecisodeumBot/1.0)";

const ALLOWED_AUTO_FEEDS = [
  "https://news.google.com/rss/search?q=emprego+brasil&hl=pt-BR&gl=BR&ceid=BR:pt-419",
  "https://news.google.com/rss/search?q=freelancer+trabalho+autonomo&hl=pt-BR&gl=BR&ceid=BR:pt-419",
  "https://news.google.com/rss/search?q=vagas+emprego+oportunidades&hl=pt-BR&gl=BR&ceid=BR:pt-419",
  "https://news.google.com/rss/search?q=mercado+trabalho+brasil&hl=pt-BR&gl=BR&ceid=BR:pt-419",
  "https://news.google.com/rss/search?q=servicos+profissionais&hl=pt-BR&gl=BR&ceid=BR:pt-419",
] as const;

type ParsedItem = {
  title: string;
  link: string;
  description: string;
  pubDate?: string;
  imageUrl?: string;
};

function autoSlug(t: string) {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function decodeHtmlEntities(input: string): string {
  let out = input;

  for (let i = 0; i < 2; i++) {
    out = out
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&apos;/gi, "'")
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&#([0-9]+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
  }

  return out;
}

/** Strip all HTML tags, decode entities, normalize whitespace */
function stripHtml(rawHtml: string): string {
  if (!rawHtml) return "";

  const decoded = decodeHtmlEntities(rawHtml);
  return decoded
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\s*\/\s*(div|li|h1|h2|h3|h4|h5|h6)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractImageFromHtml(rawHtml: string): string | null {
  if (!rawHtml) return null;
  const decoded = decodeHtmlEntities(rawHtml);

  const imgFromTag = decoded.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? null;
  if (imgFromTag) return imgFromTag;

  const imgFromMedia = decoded.match(/<media:content[^>]+url=["']([^"']+)["']/i)?.[1] ??
    decoded.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i)?.[1] ??
    decoded.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image/i)?.[1] ??
    null;

  return imgFromMedia;
}

/** Try to extract og:image and og:description from a webpage */
async function fetchOgData(url: string): Promise<{ image: string | null; description: string | null; finalUrl: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const resp = await fetch(url, {
      headers: {
        "User-Agent": BOT_UA,
        Accept: "text/html",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) return { image: null, description: null, finalUrl: url };

    const reader = resp.body?.getReader();
    if (!reader) return { image: null, description: null, finalUrl: resp.url || url };

    let html = "";
    const decoder = new TextDecoder();
    while (html.length < 80000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      if (html.includes("</head>")) break;
    }
    reader.cancel();

    const ogImageMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);

    const ogDescMatch =
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i) ||
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);

    return {
      image: ogImageMatch?.[1] || null,
      description: ogDescMatch ? stripHtml(ogDescMatch[1]) : null,
      finalUrl: resp.url || url,
    };
  } catch {
    return { image: null, description: null, finalUrl: url };
  }
}

/** Try to resolve Google News redirect to get the real article URL */
async function resolveGoogleNewsUrl(gnUrl: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const resp = await fetch(gnUrl, {
      headers: { "User-Agent": BOT_UA },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    return resp.url || gnUrl;
  } catch {
    return gnUrl;
  }
}

function parseRSSItems(xml: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag: string) => {
      const m = block.match(
        new RegExp(
          `<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`,
          "i",
        ),
      );
      return (m?.[1] || m?.[2] || "").trim();
    };

    const title = stripHtml(get("title"));
    const link = decodeHtmlEntities(get("link")).trim();
    const rawDescription = get("description");
    const description = stripHtml(rawDescription);
    const pubDate = get("pubDate");

    const mediaMatch =
      block.match(/<media:content[^>]+url="([^"]+)"/i) ||
      block.match(/<media:thumbnail[^>]+url="([^"]+)"/i) ||
      block.match(/<enclosure[^>]+url="([^"]+)"[^>]+type="image/i);

    const imageUrl = mediaMatch?.[1] || extractImageFromHtml(rawDescription);

    if (title && link) {
      items.push({
        title,
        link,
        description,
        pubDate,
        imageUrl: imageUrl || undefined,
      });
    }
  }

  return items;
}

function parseAtomItems(xml: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag: string) => {
      const m = block.match(
        new RegExp(
          `<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`,
          "i",
        ),
      );
      return (m?.[1] || m?.[2] || "").trim();
    };

    const title = stripHtml(get("title"));
    const linkMatch = block.match(/<link[^>]*href="([^"]*)"[^>]*\/?>|<link[^>]*>([^<]*)<\/link>/i);
    const link = decodeHtmlEntities(linkMatch?.[1] || linkMatch?.[2] || "").trim();
    const rawDescription = get("summary") || get("content");
    const description = stripHtml(rawDescription);
    const pubDate = get("published") || get("updated");

    const mediaMatch =
      block.match(/<media:content[^>]+url="([^"]+)"/i) || block.match(/<media:thumbnail[^>]+url="([^"]+)"/i);
    const imageUrl = mediaMatch?.[1] || extractImageFromHtml(rawDescription);

    if (title && link) {
      items.push({
        title,
        link,
        description,
        pubDate,
        imageUrl: imageUrl || undefined,
      });
    }
  }

  return items;
}

/** Reject private/internal IPs and non-HTTPS URLs */
function isUrlSafe(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname;

    if (
      hostname === "localhost" ||
      hostname.startsWith("127.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("169.254.") ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".local") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

async function importFeed(feedUrl: string, maxItems: number, supabaseUrl: string, serviceRoleKey: string) {
  const resp = await fetch(feedUrl, {
    headers: { "User-Agent": BOT_UA },
  });

  if (!resp.ok) {
    throw new Error(`Failed to fetch feed: ${resp.status}`);
  }

  const xml = await resp.text();
  let items = parseRSSItems(xml);
  if (items.length === 0) items = parseAtomItems(xml);

  const limited = items.slice(0, Math.min(maxItems, 50));
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const item of limited) {
    const slug = autoSlug(item.title).slice(0, 100);
    if (!slug) {
      skipped++;
      continue;
    }

    const checkResp = await fetch(
      `${supabaseUrl}/rest/v1/blog_posts?slug=eq.${encodeURIComponent(slug)}&select=id`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      },
    );

    if (!checkResp.ok) {
      errors.push(`${slug}: duplicate-check failed`);
      skipped++;
      continue;
    }

    const existing = await checkResp.json();
    if (Array.isArray(existing) && existing.length > 0) {
      skipped++;
      continue;
    }

    let realUrl = item.link;
    if (item.link.includes("news.google.com")) {
      realUrl = await resolveGoogleNewsUrl(item.link);
    }

    let coverImage = item.imageUrl || null;
    let articleDescription: string | null = null;

    if (realUrl && isUrlSafe(realUrl)) {
      const ogData = await fetchOgData(realUrl);
      realUrl = ogData.finalUrl || realUrl;

      if (!coverImage && ogData.image) coverImage = ogData.image;
      if (ogData.description) articleDescription = ogData.description;
    }

    const cleanRssDesc = stripHtml(item.description);
    const bestDescription =
      articleDescription && articleDescription.length > cleanRssDesc.length ? articleDescription : cleanRssDesc;

    const excerpt = (bestDescription || "").slice(0, 300);
    const content = bestDescription || "Leia a matéria completa na fonte original.";

    const insertResp = await fetch(`${supabaseUrl}/rest/v1/blog_posts`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        title: item.title,
        slug,
        excerpt,
        content,
        source_url: realUrl !== item.link ? realUrl : item.link,
        cover_image_url: coverImage,
        published: true,
        featured: false,
        author_name: "Fonte Externa",
      }),
    });

    if (insertResp.ok) {
      imported++;
    } else {
      const errText = await insertResp.text();
      errors.push(`${slug}: ${errText}`);
    }
  }

  return {
    feed_url: feedUrl,
    total_found: items.length,
    imported,
    skipped,
    errors,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const body = await req.json().catch(() => ({}));
    const feedUrl = typeof body.feed_url === "string" ? body.feed_url.trim() : "";
    const isAutomated = body?.automated === true;
    const maxItemsRequested = Number.isFinite(Number(body?.max_items)) ? Number(body.max_items) : 10;
    const maxItems = Math.max(1, Math.min(maxItemsRequested, 50));

    const feedsToImport = isAutomated
      ? ALLOWED_AUTO_FEEDS.filter((url) => !feedUrl || url === feedUrl)
      : feedUrl
        ? [feedUrl]
        : [];

    if (feedsToImport.length === 0) {
      return new Response(JSON.stringify({ error: "feed_url inválida ou não permitida para importação automática" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Auth: require admin, except safe automated mode restricted to fixed feed allowlist ---
    let isAdmin = false;
    const authHeader = req.headers.get("Authorization");

    if (authHeader) {
      const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });

      const {
        data: { user: caller },
      } = await callerClient.auth.getUser();

      if (caller) {
        const { data: adminResult } = await callerClient.rpc("has_role", { _user_id: caller.id, _role: "admin" });
        isAdmin = !!adminResult;
      }
    }

    if (!isAdmin && !isAutomated) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];
    for (const f of feedsToImport) {
      if (!isUrlSafe(f)) {
        results.push({
          feed_url: f,
          total_found: 0,
          imported: 0,
          skipped: 0,
          errors: ["URL not allowed. Only HTTPS public URLs are permitted."],
        });
        continue;
      }

      try {
        const r = await importFeed(f, isAutomated ? Math.min(maxItems, 8) : maxItems, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        results.push(r);
      } catch (err) {
        results.push({
          feed_url: f,
          total_found: 0,
          imported: 0,
          skipped: 0,
          errors: [String(err)],
        });
      }
    }

    const imported = results.reduce((acc, r) => acc + (r.imported || 0), 0);
    const skipped = results.reduce((acc, r) => acc + (r.skipped || 0), 0);
    const totalFound = results.reduce((acc, r) => acc + (r.total_found || 0), 0);
    const allErrors = results.flatMap((r) => r.errors || []);

    return new Response(
      JSON.stringify({
        success: true,
        automated: isAutomated,
        feeds_processed: results.length,
        total_found: totalFound,
        imported,
        skipped,
        results,
        errors: allErrors.length > 0 ? allErrors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal error", details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
