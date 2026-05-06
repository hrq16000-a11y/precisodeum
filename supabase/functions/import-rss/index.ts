import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BOT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const ALLOWED_AUTO_FEEDS = [
  "https://www.infomoney.com.br/feed/",
  "https://g1.globo.com/rss/g1/economia/",
  "https://exame.com/feed/",
  "https://canaltech.com.br/rss/",
  "https://olhardigital.com.br/feed/",
] as const;

type ParsedItem = {
  title: string;
  link: string;
  description: string;
  pubDate?: string;
  imageUrl?: string;
};

type ScrapedArticle = {
  image: string | null;
  description: string | null;
  fullContent: string | null;
  finalUrl: string;
};

// ─── Text utilities ───

function autoSlug(t: string) {
  return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function decodeEntities(input: string): string {
  let out = input;
  for (let i = 0; i < 2; i++) {
    out = out
      .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&apos;/gi, "'")
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&#([0-9]+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
  }
  return out;
}

function stripHtml(rawHtml: string): string {
  if (!rawHtml) return "";
  const decoded = decodeEntities(rawHtml);
  return decoded
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\s*\/\s*(div|li|h[1-6]|blockquote|figcaption)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/<a\s+href=[^\n]+/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractImageFromHtml(rawHtml: string): string | null {
  if (!rawHtml) return null;
  const decoded = decodeEntities(rawHtml);
  return decoded.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ??
    decoded.match(/<media:content[^>]+url=["']([^"']+)["']/i)?.[1] ??
    decoded.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i)?.[1] ??
    decoded.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image/i)?.[1] ??
    null;
}

function isBrokenContent(text: string): boolean {
  if (!text) return true;
  return /(^|\s)<a\s+href=|&lt;a\s+href=|news\.google\.com\/rss\/articles\//i.test(text);
}

function isUrlSafe(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "https:") return false;
    const h = parsed.hostname;
    if (h === "localhost" || h.startsWith("127.") || h.startsWith("10.") || h.startsWith("192.168.") ||
        h.startsWith("169.254.") || h.endsWith(".internal") || h.endsWith(".local") ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
    return true;
  } catch { return false; }
}

// ─── Article scraper ───

/** Extract the main text content from article body HTML */
function extractArticleBody(html: string): string {
  // Try to find <article> tag first
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const bodyZone = articleMatch?.[1] || html;

  // Remove scripts, styles, nav, aside, footer, header, form
  const cleaned = bodyZone
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<form[\s\S]*?<\/form>/gi, "")
    .replace(/<figure[\s\S]*?<\/figure>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // Extract paragraphs
  const paragraphs: string[] = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = pRegex.exec(cleaned)) !== null) {
    const text = stripHtml(m[1]);
    if (text.length > 40) paragraphs.push(text);
  }

  if (paragraphs.length >= 2) return paragraphs.join("\n\n");

  // Fallback: strip all tags from body zone
  return stripHtml(cleaned);
}

/** Extract all inline images from article body */
function extractArticleImages(html: string): string[] {
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const bodyZone = articleMatch?.[1] || html;
  const images: string[] = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  let m;
  while ((m = imgRegex.exec(bodyZone)) !== null) {
    const src = m[1];
    if (src.startsWith("http") && !src.includes("avatar") && !src.includes("icon") &&
        !src.includes("logo") && !src.includes("1x1") && !src.includes("pixel")) {
      images.push(src);
    }
  }
  return images;
}

async function scrapeArticle(url: string): Promise<ScrapedArticle> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const resp = await fetch(url, {
      headers: { "User-Agent": BOT_UA, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) return { image: null, description: null, fullContent: null, finalUrl: url };

    const finalUrl = resp.url || url;
    const isGoogleNews = finalUrl.includes("news.google.com/");
    const maxRead = isGoogleNews ? 700000 : 500000;

    const reader = resp.body?.getReader();
    if (!reader) return { image: null, description: null, fullContent: null, finalUrl };

    let html = "";
    const decoder = new TextDecoder();
    while (html.length < maxRead) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
    }
    reader.cancel();

    // ── Meta tags ──
    const ogImage =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i)?.[1];

    // Google News fallback images
    let googleImage: string | null = null;
    if (!ogImage) {
      const candidates = Array.from(html.matchAll(/https:\/\/lh3\.googleusercontent\.com[^"'\s<>]+/gi), (m) => m[0]);
      googleImage = candidates
        .map((c) => ({ c, w: Number(c.match(/(?:=s0-w|=w)(\d+)/i)?.[1] || c.match(/-w(\d+)/i)?.[1] || 0) }))
        .sort((a, b) => b.w - a.w)[0]?.c || null;
    }

    const ogDesc =
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i)?.[1] ||
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1];

    // ── Full article body ──
    let fullContent: string | null = null;
    if (!isGoogleNews) {
      const body = extractArticleBody(html);
      if (body.length > 100) fullContent = body;
    }

    // ── Article inline images ──
    let image = ogImage || googleImage || null;
    if (!image && !isGoogleNews) {
      const inlineImages = extractArticleImages(html);
      if (inlineImages.length > 0) image = inlineImages[0];
    }

    return {
      image,
      description: ogDesc ? stripHtml(ogDesc) : null,
      fullContent,
      finalUrl,
    };
  } catch {
    return { image: null, description: null, fullContent: null, finalUrl: url };
  }
}

// ─── RSS parsing ───

function parseRSSItems(xml: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
      return (m?.[1] || m?.[2] || "").trim();
    };
    const title = stripHtml(get("title"));
    const link = decodeEntities(get("link")).trim();
    const rawDesc = get("description");
    const description = stripHtml(rawDesc);
    const pubDate = get("pubDate");
    const mediaMatch = block.match(/<media:content[^>]+url="([^"]+)"/i) ||
      block.match(/<media:thumbnail[^>]+url="([^"]+)"/i) ||
      block.match(/<enclosure[^>]+url="([^"]+)"[^>]+type="image/i);
    const imageUrl = mediaMatch?.[1] || extractImageFromHtml(rawDesc);
    if (title && link) items.push({ title, link, description, pubDate, imageUrl: imageUrl || undefined });
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
      const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
      return (m?.[1] || m?.[2] || "").trim();
    };
    const title = stripHtml(get("title"));
    const linkMatch = block.match(/<link[^>]*href="([^"]*)"[^>]*\/?>|<link[^>]*>([^<]*)<\/link>/i);
    const link = decodeEntities(linkMatch?.[1] || linkMatch?.[2] || "").trim();
    const rawDesc = get("summary") || get("content");
    const description = stripHtml(rawDesc);
    const pubDate = get("published") || get("updated");
    const mediaMatch = block.match(/<media:content[^>]+url="([^"]+)"/i) || block.match(/<media:thumbnail[^>]+url="([^"]+)"/i);
    const imageUrl = mediaMatch?.[1] || extractImageFromHtml(rawDesc);
    if (title && link) items.push({ title, link, description, pubDate, imageUrl: imageUrl || undefined });
  }
  return items;
}

// ─── Import logic ───

async function importFeed(feedUrl: string, maxItems: number, supabaseUrl: string, serviceRoleKey: string, requireImage: boolean) {
  const resp = await fetch(feedUrl, { headers: { "User-Agent": BOT_UA } });
  if (!resp.ok) throw new Error(`Failed to fetch feed: ${resp.status}`);

  const xml = await resp.text();
  let items = parseRSSItems(xml);
  if (items.length === 0) items = parseAtomItems(xml);

  const limited = items.slice(0, Math.min(maxItems, 50));
  let imported = 0;
  let skipped = 0;
  let noImage = 0;
  const errors: string[] = [];

  for (const item of limited) {
    const slug = autoSlug(item.title).slice(0, 100);
    if (!slug) { skipped++; continue; }

    // Check duplicate
    const checkResp = await fetch(
      `${supabaseUrl}/rest/v1/blog_posts?slug=eq.${encodeURIComponent(slug)}&select=id`,
      { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } },
    );
    if (!checkResp.ok) { errors.push(`${slug}: dup-check fail`); skipped++; continue; }
    const existing = await checkResp.json();
    if (Array.isArray(existing) && existing.length > 0) { skipped++; continue; }

    // Resolve URL & scrape full article
    let targetUrl = item.link;
    if (item.link.includes("news.google.com")) {
      // resolveGoogleNewsUrl is done inside scrapeArticle via redirect follow
    }

    const scraped = await scrapeArticle(targetUrl);
    const realUrl = scraped.finalUrl || targetUrl;

    // Cover image: RSS media → scraped OG/body
    const coverImage = item.imageUrl || scraped.image || null;

    // Skip if no image and requireImage is on
    if (requireImage && !coverImage) {
      noImage++;
      continue;
    }

    // Content: prefer full scraped article, fallback to OG description, then RSS desc
    const rssDesc = stripHtml(item.description);
    let bestContent = "";
    if (scraped.fullContent && scraped.fullContent.length > 100 && !isBrokenContent(scraped.fullContent)) {
      bestContent = scraped.fullContent;
    } else if (scraped.description && scraped.description.length > rssDesc.length && !isBrokenContent(scraped.description)) {
      bestContent = scraped.description;
    } else if (rssDesc && !isBrokenContent(rssDesc)) {
      bestContent = rssDesc;
    }

    const content = bestContent || "Leia a matéria completa na fonte original.";
    const excerpt = (scraped.description && !isBrokenContent(scraped.description) ? scraped.description : bestContent).slice(0, 300);

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

  return { feed_url: feedUrl, total_found: items.length, imported, skipped, no_image: noImage, errors };
}

// ─── Main handler ───

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
    const requireImage = body?.require_image !== false; // default true
    const maxItemsRequested = Number.isFinite(Number(body?.max_items)) ? Number(body.max_items) : 10;
    const maxItems = Math.max(1, Math.min(maxItemsRequested, 50));

    const feedsToImport = isAutomated
      ? ALLOWED_AUTO_FEEDS.filter((url) => !feedUrl || url === feedUrl)
      : feedUrl ? [feedUrl] : [];

    if (feedsToImport.length === 0) {
      return new Response(JSON.stringify({ error: "feed_url inválida ou não permitida" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth: require admin JWT, service_role JWT, or valid cron secret for automated calls
    let isAdmin = false;
    let isServiceRole = false;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      // Check if it's the service_role key (used by pg_cron)
      if (token === SUPABASE_SERVICE_ROLE_KEY) {
        isServiceRole = true;
      } else {
        const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user: caller } } = await callerClient.auth.getUser();
        if (caller) {
          const { data: adminResult } = await callerClient.rpc("has_role", { _user_id: caller.id, _role: "admin" });
          isAdmin = !!adminResult;
        }
      }
    }

    // Validate automated mode via shared secret header instead of trusting body flag
    let isAutomatedValid = false;
    if (isAutomated) {
      const cronSecret = Deno.env.get("CRON_SECRET");
      const providedSecret = req.headers.get("x-cron-secret");
      if (cronSecret && providedSecret === cronSecret) {
        isAutomatedValid = true;
      }
    }

    if (!isAdmin && !isServiceRole && !isAutomatedValid) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];
    for (const f of feedsToImport) {
      if (!isUrlSafe(f)) {
        results.push({ feed_url: f, total_found: 0, imported: 0, skipped: 0, no_image: 0, errors: ["URL not allowed"] });
        continue;
      }
      try {
        const r = await importFeed(f, isAutomated ? Math.min(maxItems, 8) : maxItems, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, requireImage);
        results.push(r);
      } catch (err) {
        results.push({ feed_url: f, total_found: 0, imported: 0, skipped: 0, no_image: 0, errors: [String(err)] });
      }
    }

    const imported = results.reduce((acc, r) => acc + (r.imported || 0), 0);
    const skipped = results.reduce((acc, r) => acc + (r.skipped || 0), 0);
    const noImage = results.reduce((acc, r) => acc + (r.no_image || 0), 0);
    const totalFound = results.reduce((acc, r) => acc + (r.total_found || 0), 0);
    const allErrors = results.flatMap((r) => r.errors || []);

    return new Response(
      JSON.stringify({
        success: true, automated: isAutomated, feeds_processed: results.length,
        total_found: totalFound, imported, skipped, no_image: noImage, results,
        errors: allErrors.length > 0 ? allErrors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal error", details: String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
