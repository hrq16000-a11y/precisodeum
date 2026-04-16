/**
 * Supreme client-side image compression engine.
 * 
 * Strategy:
 * 1. Try AVIF (best compression ratio, ~50% smaller than WebP)
 * 2. Fallback to WebP (universal modern support)
 * 3. Adaptive quality stepping based on file size
 * 4. Smart dimension scaling per use-case
 * 5. Multi-pass: if first pass still too large, re-compress from canvas
 * 
 * Link preservation: output always uses the same base name with new extension.
 * The storage hash system ensures the same content always maps to the same URL.
 */

const DEFAULT_MAX_DIMENSION = 1920;
const DEFAULT_TARGET_KB = 400;

/** Adaptive quality steps: more aggressive for larger files */
const QUALITY_TIERS = {
  large:  [0.75, 0.6, 0.45, 0.35, 0.25],  // > 2MB
  medium: [0.80, 0.65, 0.50, 0.40, 0.30],  // 1-2MB
  small:  [0.85, 0.72, 0.58, 0.45, 0.35],  // < 1MB
};

/** Preferred output formats in order of efficiency */
const OUTPUT_FORMATS: Array<{ mime: string; ext: string }> = [
  { mime: 'image/avif', ext: 'avif' },
  { mime: 'image/webp', ext: 'webp' },
];

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/** Check if the browser supports encoding a given format */
async function supportsFormat(mime: string): Promise<boolean> {
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, mime, 0.5));
    return !!blob && blob.type === mime;
  } catch {
    return false;
  }
}

/** Cache format support checks */
const formatSupportCache = new Map<string, boolean>();

async function getBestFormat(): Promise<{ mime: string; ext: string }> {
  for (const fmt of OUTPUT_FORMATS) {
    let supported = formatSupportCache.get(fmt.mime);
    if (supported === undefined) {
      supported = await supportsFormat(fmt.mime);
      formatSupportCache.set(fmt.mime, supported);
    }
    if (supported) return fmt;
  }
  // Ultimate fallback
  return { mime: 'image/jpeg', ext: 'jpg' };
}

function getQualitySteps(fileSize: number): number[] {
  if (fileSize > 2 * 1024 * 1024) return QUALITY_TIERS.large;
  if (fileSize > 1 * 1024 * 1024) return QUALITY_TIERS.medium;
  return QUALITY_TIERS.small;
}

/** Calculate optimal dimensions preserving aspect ratio */
function calcDimensions(
  origW: number,
  origH: number,
  maxDim: number
): { width: number; height: number } {
  if (origW <= maxDim && origH <= maxDim) {
    return { width: origW, height: origH };
  }
  const ratio = Math.min(maxDim / origW, maxDim / origH);
  return {
    width: Math.round(origW * ratio),
    height: Math.round(origH * ratio),
  };
}

async function canvasToFile(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
  baseName: string,
  ext: string
): Promise<File | null> {
  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, mime, quality)
  );
  if (!blob || blob.size < 100) return null;
  const name = baseName.replace(/\.[^.]+$/, `.${ext}`);
  return new File([blob], name, { type: mime });
}

export interface CompressOptions {
  /** Maximum width or height in pixels (default 1920) */
  maxDimension?: number;
  /** Target file size in KB (default 400) */
  targetKB?: number;
  /** Force a specific output format ('avif' | 'webp' | 'jpeg') */
  forceFormat?: string;
}

/**
 * Generate a tiny base64 blur placeholder (LQIP) from an image file.
 * Returns a data URL string (~20x20px, ~500 bytes).
 */
export async function generateBlurDataUrl(file: File): Promise<string | null> {
  try {
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return null;
    const img = await loadImage(file);
    const BLUR_SIZE = 20;
    const { width, height } = calcDimensions(img.naturalWidth, img.naturalHeight, BLUR_SIZE);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(img.src);
    return canvas.toDataURL('image/webp', 0.3);
  } catch {
    return null;
  }
}

/**
 * Compress an image file using the best available format.
 * Returns the smallest result that meets the target, preserving
 * the original file name (with updated extension).
 */
export async function compressImage(
  file: File,
  opts?: CompressOptions
): Promise<File> {
  // Skip non-image or already tiny files
  const targetBytes = (opts?.targetKB ?? DEFAULT_TARGET_KB) * 1024;
  if (!file.type.startsWith('image/') || file.size <= targetBytes) {
    return file;
  }

  // Skip SVG/GIF (can't be canvas-compressed meaningfully)
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  const maxDim = opts?.maxDimension ?? DEFAULT_MAX_DIMENSION;

  const img = await loadImage(file);
  const { width, height } = calcDimensions(img.naturalWidth, img.naturalHeight, maxDim);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Use high-quality resampling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  // Release object URL
  URL.revokeObjectURL(img.src);

  // Determine best output format
  let format: { mime: string; ext: string };
  if (opts?.forceFormat) {
    const m = opts.forceFormat === 'avif' ? 'image/avif'
      : opts.forceFormat === 'webp' ? 'image/webp'
      : 'image/jpeg';
    format = { mime: m, ext: opts.forceFormat };
  } else {
    format = await getBestFormat();
  }

  const qualitySteps = getQualitySteps(file.size);
  let bestResult: File | null = null;

  // Pass 1: try each quality step with best format
  for (const q of qualitySteps) {
    const result = await canvasToFile(canvas, format.mime, q, file.name, format.ext);
    if (!result) continue;

    // Keep track of smallest successful result
    if (!bestResult || result.size < bestResult.size) {
      bestResult = result;
    }

    // If under target, we're done
    if (result.size <= targetBytes) {
      return result;
    }
  }

  // Pass 2: if AVIF/WebP didn't hit target, try the other format
  if (bestResult && bestResult.size > targetBytes && format.mime !== 'image/webp') {
    const webpSupported = formatSupportCache.get('image/webp') ?? await supportsFormat('image/webp');
    if (webpSupported) {
      for (const q of qualitySteps) {
        const result = await canvasToFile(canvas, 'image/webp', q, file.name, 'webp');
        if (!result) continue;
        if (!bestResult || result.size < bestResult.size) {
          bestResult = result;
        }
        if (result.size <= targetBytes) return result;
      }
    }
  }

  // Pass 3: if still too large, try reducing dimensions further
  if (bestResult && bestResult.size > targetBytes && (width > 1200 || height > 1200)) {
    const { width: w2, height: h2 } = calcDimensions(width, height, 1200);
    const canvas2 = document.createElement('canvas');
    canvas2.width = w2;
    canvas2.height = h2;
    const ctx2 = canvas2.getContext('2d')!;
    ctx2.imageSmoothingEnabled = true;
    ctx2.imageSmoothingQuality = 'high';
    ctx2.drawImage(canvas, 0, 0, w2, h2);

    for (const q of qualitySteps.slice(0, 3)) {
      const result = await canvasToFile(canvas2, format.mime, q, file.name, format.ext);
      if (!result) continue;
      if (result.size < bestResult.size) {
        bestResult = result;
      }
      if (result.size <= targetBytes) return result;
    }
  }

  // Return best result if it's smaller than original, otherwise original
  if (bestResult && bestResult.size < file.size) {
    return bestResult;
  }

  return file;
}
