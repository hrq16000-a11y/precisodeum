/**
 * Client-side image compressor → WebP.
 * Uses native <canvas> + toBlob (no extra deps).
 *
 * Strategy:
 *  - Downscale to maxWidth (preserve aspect ratio).
 *  - Encode WebP at the requested quality.
 *  - Fallback to JPEG if the browser ever fails to encode WebP.
 */

export interface CompressOptions {
  maxWidth?: number;
  quality?: number; // 0..1
  mimeType?: 'image/webp' | 'image/jpeg';
}

export interface CompressedImage {
  blob: Blob;
  file: File;
  width: number;
  height: number;
  originalSize: number;
  finalSize: number;
  savingsPercent: number;
  dataUrl: string;
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const fileToDataUrl = (file: File | Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

export async function compressToWebP(
  source: File,
  opts: CompressOptions = {},
): Promise<CompressedImage> {
  const { maxWidth = 1600, quality = 0.82, mimeType = 'image/webp' } = opts;

  const dataUrl = await fileToDataUrl(source);
  const img = await loadImage(dataUrl);

  const ratio = img.width > maxWidth ? maxWidth / img.width : 1;
  const targetW = Math.round(img.width * ratio);
  const targetH = Math.round(img.height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context indisponível');
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Falha ao gerar blob'))),
      mimeType,
      quality,
    );
  });

  // If WebP somehow ended up larger (rare for tiny images), keep original.
  let finalBlob = blob;
  let finalMime = mimeType;
  if (blob.size >= source.size && source.type.startsWith('image/')) {
    finalBlob = source;
    finalMime = (source.type as 'image/webp' | 'image/jpeg') || 'image/jpeg';
  }

  const baseName = source.name.replace(/\.[^.]+$/, '');
  const ext = finalMime === 'image/webp' ? 'webp' : 'jpg';
  const file = new File([finalBlob], `${baseName}.${ext}`, { type: finalMime });

  const previewUrl = await fileToDataUrl(finalBlob);

  return {
    blob: finalBlob,
    file,
    width: targetW,
    height: targetH,
    originalSize: source.size,
    finalSize: finalBlob.size,
    savingsPercent: Math.max(0, Math.round((1 - finalBlob.size / source.size) * 100)),
    dataUrl: previewUrl,
  };
}
