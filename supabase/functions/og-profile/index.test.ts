// Deno test for `og-profile` edge function.
//
// We cannot easily import the function module here because it binds
// `Deno.serve` at module top-level. Instead we test against the deployed
// endpoint, asserting that:
//   - Real-user UAs get a 302 redirect to /profissional/:slug
//   - Crawler UAs (WhatsApp, Facebook, Twitter, Telegram, generic bot)
//     get text/html with og:title, og:description, og:image, twitter:card
//     and proper Cache-Control + ETag headers
//   - Repeating a request with the previous ETag returns 304
//
// Run:
//   supabase functions test og-profile
//
// Requires .env at the project root with VITE_SUPABASE_URL.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import {
  assert,
  assertEquals,
  assertMatch,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ??
  "https://qaftogrqeyymewoofexc.supabase.co";
const FN_URL = `${SUPABASE_URL}/functions/v1/og-profile`;

// Slug propositalmente improvável de existir — força fallback determinístico
// (título/descrição/imagem padrão), mas todas as meta tags ainda devem estar
// presentes para qualquer crawler. Trocar para um slug real torna o teste
// dependente de dados de produção.
const FALLBACK_SLUG = "ci-test-nonexistent-profile-slug";

const CRAWLER_UAS: Record<string, string> = {
  whatsapp: "WhatsApp/2.23.20.0 A",
  facebook:
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  twitter: "Twitterbot/1.0",
  telegram: "TelegramBot (like TwitterBot)",
  linkedin: "LinkedInBot/1.0 (compatible; Mozilla/5.0; +http://www.linkedin.com)",
};

const HUMAN_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function fetchOg(ua: string, headers: Record<string, string> = {}) {
  return await fetch(`${FN_URL}?slug=${FALLBACK_SLUG}`, {
    method: "GET",
    redirect: "manual",
    headers: { "User-Agent": ua, ...headers },
  });
}

Deno.test("og-profile: human user is redirected (302) to SPA", async () => {
  const res = await fetchOg(HUMAN_UA);
  await res.body?.cancel();
  assertEquals(res.status, 302);
  const location = res.headers.get("location") ?? "";
  assertMatch(location, /\/profissional\/[a-z0-9-]+$/);
});

for (const [name, ua] of Object.entries(CRAWLER_UAS)) {
  Deno.test(`og-profile: ${name} crawler receives full OG meta tags`, async () => {
    const res = await fetchOg(ua);
    assertEquals(res.status, 200);

    const ct = res.headers.get("content-type") ?? "";
    assertStringIncludes(ct, "text/html");

    const cache = res.headers.get("cache-control") ?? "";
    assertStringIncludes(cache, "max-age=");
    assertStringIncludes(cache, "stale-while-revalidate");

    const etag = res.headers.get("etag");
    assert(etag && etag.length > 0, "ETag header should be present");

    const html = await res.text();
    assertStringIncludes(html, '<meta property="og:title"');
    assertStringIncludes(html, '<meta property="og:description"');
    assertStringIncludes(html, '<meta property="og:image"');
    assertStringIncludes(html, '<meta property="og:url"');
    assertStringIncludes(html, '<meta name="twitter:card" content="summary_large_image"');
    assertStringIncludes(html, '<link rel="canonical"');
  });
}

Deno.test("og-profile: ETag revalidation returns 304 Not Modified", async () => {
  const first = await fetchOg(CRAWLER_UAS.whatsapp);
  await first.text();
  const etag = first.headers.get("etag");
  assert(etag, "first response must include ETag");

  const second = await fetchOg(CRAWLER_UAS.whatsapp, { "If-None-Match": etag });
  await second.body?.cancel();
  assertEquals(second.status, 304);
  assertEquals(second.headers.get("etag"), etag);
});

Deno.test("og-profile: empty/invalid slug still returns valid OG fallback for crawlers", async () => {
  const res = await fetch(`${FN_URL}?slug=`, {
    method: "GET",
    redirect: "manual",
    headers: { "User-Agent": CRAWLER_UAS.facebook },
  });
  const html = await res.text();
  assertEquals(res.status, 200);
  assertStringIncludes(html, '<meta property="og:title"');
  assertStringIncludes(html, '<meta property="og:image"');
});
