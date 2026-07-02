// Helper compartilhado entre a edge function og-profile e seus testes.
//
// Gera variantes de og:image (1200x630 retangular vs 1080x1080 quadrada)
// aplicando Supabase Image Transforms (/storage/v1/render/image/...) sobre
// a URL canônica do avatar. NÃO upa nada novo — usa o que já existe no
// Storage com cache de edge nativo.
//
// Seleção por plataforma:
//   - WhatsApp / LinkedIn / Telegram / Discord / Slack: preferem 1:1 (thumbnail).
//     Esses crawlers cropam silenciosamente para quadrado, então servimos já 1:1
//     para evitar zoom errado na cabeça do profissional.
//   - Facebook / Twitter / Pinterest / Embedly: preferem 1200x630 (paisagem).
//   - Default (bots desconhecidos / Googlebot): 1200x630 — formato Open Graph
//     mais bem suportado.

export type OgImageRatio = "wide" | "square";

export interface OgImageSpec {
  width: number;
  height: number;
  quality: number;
}

export const OG_IMAGE_SPECS: Record<OgImageRatio, OgImageSpec> = {
  wide:   { width: 1200, height: 630, quality: 82 },
  square: { width: 1080, height: 1080, quality: 82 },
};

/**
 * Crawlers que renderizam preview em formato quadrado (1:1).
 * Match case-insensitive por substring.
 */
const SQUARE_PREVIEW_CRAWLERS = [
  "whatsapp",
  "linkedinbot",
  "telegrambot",
  "discordbot",
  "slackbot",
  "skypeuripreview",
];

export function pickOgRatio(userAgent: string | null | undefined): OgImageRatio {
  if (!userAgent) return "wide";
  const lc = userAgent.toLowerCase();
  return SQUARE_PREVIEW_CRAWLERS.some((sig) => lc.includes(sig)) ? "square" : "wide";
}

/**
 * Aplica transform sobre uma URL pública do Supabase Storage.
 * Se a URL não for do Storage (ex: avatar do Google, externo), devolve
 * a URL original — crawlers ainda verão *algo*, só sem crop perfeito.
 */
export function buildOgImage(
  url: string | null | undefined,
  ratio: OgImageRatio,
): string {
  if (!url) return "";
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  const m = parsed.pathname.match(
    /^\/storage\/v1\/(?:object|render\/image)\/public\/([^/]+)\/(.+)$/,
  );
  if (!m) return url; // URL externa — devolve como veio

  const bucket = m[1];
  const path = m[2].split("?")[0];
  const spec = OG_IMAGE_SPECS[ratio];

  // resize=cover garante crop centralizado para preencher a área desejada
  // (importante: avatars são tipicamente quadrados mas o transform gera
  // canvas final no aspect ratio pedido).
  return `${parsed.protocol}//${parsed.host}/storage/v1/render/image/public/${bucket}/${path}` +
    `?width=${spec.width}&height=${spec.height}&quality=${spec.quality}&resize=cover`;
}
