/**
 * imageVariants — gera URLs de variantes (thumb / medium / original) sob demanda
 * usando Supabase Image Transforms (`/storage/v1/render/image/...`).
 *
 * NÃO precisamos pré-gerar 3 arquivos físicos: o Storage redimensiona on-the-fly
 * e cacheia no edge. Isso reduz custo de upload (1 só POST) e mantém integridade
 * de links — `original` continua sendo a URL canônica armazenada no banco.
 *
 * Uso típico em <img>:
 *   const v = getImageVariants(url);
 *   <img src={v.medium} srcSet={v.srcSet} sizes="(max-width: 640px) 320px, 800px" />
 */

export type VariantName = 'thumb' | 'medium' | 'original';

export interface VariantSpec {
  width: number;
  quality: number;
}

/** Perfis padrão. Quality alinhado com `optimize-image` edge function. */
export const VARIANT_PROFILES: Record<Exclude<VariantName, 'original'>, VariantSpec> = {
  thumb:  { width: 320, quality: 70 }, // listas, cards, avatares grandes
  medium: { width: 800, quality: 78 }, // galeria, hero do card
  // original = sem transform (URL canônica)
};

export interface ImageVariants {
  thumb: string;
  medium: string;
  original: string;
  /** Pronto para uso em `srcSet` */
  srcSet: string;
}

/**
 * Detecta se a URL é do Supabase Storage público e retorna bucket/path.
 * Aceita: https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
 */
function parseStorageUrl(url: string): { base: string; bucket: string; path: string } | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/^\/storage\/v1\/(?:object|render\/image)\/public\/([^/]+)\/(.+)$/);
    if (!m) return null;
    return {
      base: `${u.protocol}//${u.host}`,
      bucket: m[1],
      path: m[2],
    };
  } catch {
    return null;
  }
}

function buildTransformUrl(
  base: string,
  bucket: string,
  path: string,
  spec: VariantSpec
): string {
  return `${base}/storage/v1/render/image/public/${bucket}/${path}?width=${spec.width}&quality=${spec.quality}&resize=contain`;
}

/**
 * Gera variantes para uma URL de imagem do Supabase. Se a URL não for do Storage
 * (ex: avatar do Google, link externo), devolve a mesma URL para todas as
 * variantes (fallback transparente).
 */
export function getImageVariants(url: string | null | undefined): ImageVariants {
  if (!url) {
    return { thumb: '', medium: '', original: '', srcSet: '' };
  }

  const parsed = parseStorageUrl(url);
  if (!parsed) {
    // URL externa ou formato desconhecido — sem transform
    return { thumb: url, medium: url, original: url, srcSet: '' };
  }

  // Se já vier com `?width=...`, devolve ela como original limpa
  const cleanPath = parsed.path.split('?')[0];
  const original = `${parsed.base}/storage/v1/object/public/${parsed.bucket}/${cleanPath}`;

  const thumb  = buildTransformUrl(parsed.base, parsed.bucket, cleanPath, VARIANT_PROFILES.thumb);
  const medium = buildTransformUrl(parsed.base, parsed.bucket, cleanPath, VARIANT_PROFILES.medium);

  return {
    thumb,
    medium,
    original,
    srcSet: `${thumb} 320w, ${medium} 800w, ${original} 1600w`,
  };
}

/** Atalho para um único tamanho. */
export function getImageVariant(url: string | null | undefined, name: VariantName): string {
  const v = getImageVariants(url);
  return v[name] || (url ?? '');
}
