/**
 * Client-side image compression using canvas.
 * Reduces file size before uploading to save bandwidth.
 */

const MAX_DIMENSION = 1920;
const TARGET_SIZE_KB = 500;
const QUALITY_STEPS = [0.85, 0.7, 0.55, 0.4];

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export async function compressImage(
  file: File,
  opts?: { maxDimension?: number; targetKB?: number }
): Promise<File> {
  // Skip non-image or already small files
  if (!file.type.startsWith('image/') || file.size <= (opts?.targetKB ?? TARGET_SIZE_KB) * 1024) {
    return file;
  }

  // Skip SVG/GIF (can't be canvas-compressed meaningfully)
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  const maxDim = opts?.maxDimension ?? MAX_DIMENSION;
  const targetBytes = (opts?.targetKB ?? TARGET_SIZE_KB) * 1024;

  const img = await loadImage(file);
  let { width, height } = img;

  // Scale down if larger than maxDimension
  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, width, height);

  // Release object URL
  URL.revokeObjectURL(img.src);

  // Try progressively lower quality until under target
  for (const q of QUALITY_STEPS) {
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, 'image/webp', q)
    );
    if (blob && blob.size <= targetBytes) {
      const name = file.name.replace(/\.[^.]+$/, '.webp');
      return new File([blob], name, { type: 'image/webp' });
    }
  }

  // Fallback: use lowest quality result
  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, 'image/webp', 0.4)
  );
  if (blob) {
    const name = file.name.replace(/\.[^.]+$/, '.webp');
    return new File([blob], name, { type: 'image/webp' });
  }

  return file;
}
