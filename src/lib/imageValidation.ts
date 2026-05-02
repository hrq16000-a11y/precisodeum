/**
 * imageValidation — validações pré-upload (tipo, tamanho, dimensões).
 *
 * Bloqueia arquivos inválidos ANTES de chamar compressão/upload, reduzindo
 * falhas previsíveis e economizando banda em redes 3G/4G.
 *
 * Regras default:
 *   - MIME: image/jpeg, image/png, image/webp, image/avif, image/gif, image/heic, image/heif
 *   - Tamanho: 50KB ≤ size ≤ 10MB (default; configurável por componente)
 *   - Dimensões: 200×200 ≤ dim ≤ 8000×8000 (sanity check anti-DoS)
 */

export interface ImageValidationOptions {
  /** Tamanho máximo em bytes. Default 10MB. */
  maxSizeBytes?: number;
  /** Tamanho mínimo em bytes (anti-arquivo-vazio). Default 1KB. */
  minSizeBytes?: number;
  /** Largura/altura máxima por lado. Default 8000. */
  maxDimension?: number;
  /** Largura/altura mínima por lado. Default 64. */
  minDimension?: number;
  /** MIMEs permitidos. Default: lista padrão de imagens. */
  allowedMimes?: string[];
  /** Pular checagem de dimensões (útil pra HEIC que o browser não decodifica). */
  skipDimensionCheck?: boolean;
}

export interface ImageValidationResult {
  ok: boolean;
  /** Mensagem amigável (i18n PT-BR) — pronta pra toast. */
  message?: string;
  /** Código curto pra telemetria. */
  code?:
    | 'invalid_type'
    | 'too_large'
    | 'too_small'
    | 'dim_too_large'
    | 'dim_too_small'
    | 'corrupt';
  /** Dimensões medidas (quando aplicável). */
  width?: number;
  height?: number;
}

const DEFAULT_ALLOWED = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/heic',
  'image/heif',
];

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

/** Mede dimensões reais via decodeImage. Falha → corrompido/formato não decodificável. */
function measureDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const out = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(out);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode_failed'));
    };
    img.src = url;
  });
}

export async function validateImageFile(
  file: File,
  opts: ImageValidationOptions = {}
): Promise<ImageValidationResult> {
  const {
    maxSizeBytes = 10 * 1024 * 1024,
    minSizeBytes = 1024,
    maxDimension = 8000,
    minDimension = 64,
    allowedMimes = DEFAULT_ALLOWED,
    skipDimensionCheck = false,
  } = opts;

  // ── Tipo ──
  const mime = (file.type || '').toLowerCase();
  if (!mime.startsWith('image/') || !allowedMimes.includes(mime)) {
    return {
      ok: false,
      code: 'invalid_type',
      message: `Formato não suportado (${mime || 'desconhecido'}). Use JPG, PNG, WebP ou HEIC.`,
    };
  }

  // ── Tamanho ──
  if (file.size > maxSizeBytes) {
    return {
      ok: false,
      code: 'too_large',
      message: `Arquivo muito grande (${formatSize(file.size)}). Envie no máximo ${formatSize(maxSizeBytes).replace('.0', '')}.`,
    };
  }
  if (file.size < minSizeBytes) {
    return {
      ok: false,
      code: 'too_small',
      message: `Arquivo muito pequeno (${formatSize(file.size)}) — pode estar corrompido.`,
    };
  }

  // ── Dimensões (best-effort; HEIC/HEIF não decodificam em todos os browsers) ──
  if (skipDimensionCheck || mime === 'image/heic' || mime === 'image/heif') {
    return { ok: true };
  }

  try {
    const { width, height } = await measureDimensions(file);
    if (width > maxDimension || height > maxDimension) {
      return {
        ok: false,
        code: 'dim_too_large',
        width,
        height,
        message: `Dimensões muito grandes (${width}×${height}). Máximo: ${maxDimension}px por lado.`,
      };
    }
    if (width < minDimension || height < minDimension) {
      return {
        ok: false,
        code: 'dim_too_small',
        width,
        height,
        message: `Imagem pequena demais (${width}×${height}). Mínimo: ${minDimension}px.`,
      };
    }
    return { ok: true, width, height };
  } catch {
    return {
      ok: false,
      code: 'corrupt',
      message: 'Imagem corrompida ou formato não suportado pelo navegador.',
    };
  }
}
