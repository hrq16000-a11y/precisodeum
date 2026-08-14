/**
 * imageHealth — auditoria de contrato de imagem (hero/gallery) no cliente.
 *
 * Coleta dois sinais por rota, enviados junto com os Core Web Vitals:
 *  - `IMG_ERROR`    → nº de imagens que falharam ao carregar (onerror / <source> quebrado);
 *  - `IMG_DEGRADED` → nº de imagens fora do contrato (sem AVIF, sem WebP, sem
 *    srcSet, sem sizes ou sem blur-up), que costumam preceder picos de LCP.
 *
 * As funções de auditoria são puras (testáveis sem DOM real além do elemento).
 */

export type ImageIssue =
  | 'error'
  | 'no_avif'
  | 'no_webp'
  | 'no_srcset'
  | 'no_sizes'
  | 'no_blurup';

export interface ImageAudit {
  scope: 'hero' | 'gallery';
  issues: ImageIssue[];
}

/** Seletor das imagens que participam do contrato (hero <picture> + LazyImage). */
export const IMAGE_CONTRACT_SELECTOR = 'picture img, img[data-loaded], img[data-img-scope]';

const scopeOf = (img: Element): 'hero' | 'gallery' => {
  const explicit = img.getAttribute('data-img-scope');
  if (explicit === 'hero' || explicit === 'gallery') return explicit;
  return img.closest('picture') ? 'hero' : 'gallery';
};

/** Audita um <img> (e o <picture> pai, quando existir) contra o contrato. */
export function auditImageElement(img: HTMLImageElement): ImageAudit {
  const issues: ImageIssue[] = [];
  const scope = scopeOf(img);
  const picture = img.closest('picture');

  if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) {
    issues.push('error');
  }

  if (picture) {
    const types = Array.from(picture.querySelectorAll('source')).map((s) => s.getAttribute('type'));
    if (!types.includes('image/avif')) issues.push('no_avif');
    if (!types.includes('image/webp')) issues.push('no_webp');
  }

  const srcset = img.getAttribute('srcset') || picture?.querySelector('source')?.getAttribute('srcset');
  if (!srcset) issues.push('no_srcset');

  const sizes = img.getAttribute('sizes') || picture?.querySelector('source')?.getAttribute('sizes');
  if (srcset && !sizes) issues.push('no_sizes');

  if (scope === 'gallery') {
    const wrapper = img.parentElement;
    const hasBlur = !!wrapper?.querySelector('[data-testid="lazy-image-blur"]');
    const hasShimmer = !!wrapper?.className?.toString().includes('skeleton-shimmer');
    if (!hasBlur && !hasShimmer) issues.push('no_blurup');
  }

  return { scope, issues };
}

export interface ImageHealthCounters {
  errors: number;
  degraded: number;
  audited: number;
  byIssue: Record<ImageIssue, number>;
}

const emptyByIssue = (): Record<ImageIssue, number> => ({
  error: 0,
  no_avif: 0,
  no_webp: 0,
  no_srcset: 0,
  no_sizes: 0,
  no_blurup: 0,
});

/** Consolida auditorias + erros observados em contadores prontos para telemetria. */
export function summarizeImageAudits(audits: ImageAudit[], runtimeErrors = 0): ImageHealthCounters {
  const byIssue = emptyByIssue();
  let degraded = 0;
  let errors = runtimeErrors;

  for (const a of audits) {
    let bad = false;
    for (const issue of a.issues) {
      byIssue[issue] += 1;
      if (issue === 'error') errors += 1;
      else bad = true;
    }
    if (bad) degraded += 1;
  }

  return { errors, degraded, audited: audits.length, byIssue };
}

// ---------------------------------------------------------------------------
// Coletor de runtime (best-effort, sem impacto no render)
// ---------------------------------------------------------------------------

let runtimeErrors = 0;
let installed = false;

/** Escuta falhas de carregamento de <img>/<source> em toda a página. */
export function installImageHealthCollector() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener(
    'error',
    (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (tag === 'IMG' || tag === 'SOURCE') runtimeErrors += 1;
    },
    true,
  );
}

/** Lê os contadores da rota atual e zera o acumulador de erros. */
export function collectImageHealth(root: ParentNode = document): ImageHealthCounters {
  const nodes = Array.from(root.querySelectorAll<HTMLImageElement>(IMAGE_CONTRACT_SELECTOR));
  const audits = nodes.slice(0, 60).map(auditImageElement);
  const result = summarizeImageAudits(audits, runtimeErrors);
  runtimeErrors = 0;
  return result;
}
