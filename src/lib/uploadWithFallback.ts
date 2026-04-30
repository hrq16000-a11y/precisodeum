/**
 * uploadWithFallback — orquestra compressão + upload com fallback progressivo.
 *
 * Pipeline:
 *   1) compressImage com perfil padrão (1200px / target alvo)
 *   2) resilientUpload (já tem retry exponencial interno)
 *
 * Se o upload falhar mesmo após o retry interno, aplicamos fallback
 * progressivo (downgrade visual em troca de subir de qualquer jeito):
 *
 *   level 1 → re-comprime com targetKB menor (200KB)
 *   level 2 → reduz resolução (max 800px) + targetKB menor (150KB)
 *   level 3 → último recurso: arquivo original sem compressão
 *
 * Cada etapa emite eventos via `onStage` para a UI (barra de progresso) e
 * registra telemetria por etapa em `upload_test_results`.
 */

import { compressImage } from './compressImage';
import { resilientUpload } from './uploadResilient';
import { withStageTelemetry, recordStageTelemetry, type UploadStage } from './uploadStageTelemetry';
import { resolveAdaptiveProfile, type AdaptiveProfile } from './adaptiveCompression';
import { classifyUploadError, CompressionError } from './uploadErrors';

export interface UploadFallbackResult<T> {
  data: T;
  /** 0 = sem fallback, 1..3 = nível aplicado. */
  fallbackLevel: number;
  /** Tamanho final (bytes) do arquivo enviado. */
  finalSize: number;
  /** Perfil adaptativo aplicado na primeira tentativa (debug/telemetria). */
  adaptiveProfile?: AdaptiveProfile;
}

export interface UploadStageEvent {
  stage: UploadStage;
  status: 'start' | 'done' | 'error';
}

export interface UploadWithFallbackOptions {
  /** URL do edge `optimize-image` (já autenticado pelo caller). */
  url: string;
  /** Headers (apikey + Authorization). */
  headers: Record<string, string>;
  /** Builder do FormData a partir do arquivo final (permite anexar bucket/folder). */
  buildFormData: (file: File) => FormData;
  /** Perfil base de compressão (default 1200px / 300KB). */
  baseMaxDimension?: number;
  baseTargetKB?: number;
  /** Callback de progresso por etapa. */
  onStage?: (event: UploadStageEvent) => void;
  /** Callback ao iniciar/repetir upload (mostra "Tentando novamente N/M" e o motivo). */
  onAttempt?: (attempt: number, max: number, reason?: 'initial' | 'timeout' | 'network' | 'server') => void;
}

interface FallbackRecipe {
  level: number;
  maxDimension?: number;
  targetKB?: number;
  /** Se true, manda o arquivo original sem passar por canvas. */
  raw?: boolean;
}

const FALLBACK_RECIPES: FallbackRecipe[] = [
  { level: 1, maxDimension: 1200, targetKB: 200 },
  { level: 2, maxDimension: 800,  targetKB: 150 },
  { level: 3, raw: true },
];

export async function uploadWithFallback<T = any>(
  rawFile: File,
  opts: UploadWithFallbackOptions
): Promise<UploadFallbackResult<T>> {
  const baseMaxDim = opts.baseMaxDimension ?? 1200;
  const baseTarget = opts.baseTargetKB ?? 300;

  const compressForLevel = async (level: number, recipe?: FallbackRecipe): Promise<File> => {
    if (recipe?.raw) return rawFile;
    return withStageTelemetry(
      'compress',
      () =>
        compressImage(rawFile, {
          maxDimension: recipe?.maxDimension ?? baseMaxDim,
          targetKB: recipe?.targetKB ?? baseTarget,
          onStage: (stage, status) => {
            opts.onStage?.({ stage, status });
          },
        }),
      { fileSizeBytes: rawFile.size, fallbackLevel: level }
    );
  };

  const tryUpload = async (file: File, level: number): Promise<T> => {
    opts.onStage?.({ stage: 'upload', status: 'start' });
    try {
      const data = await withStageTelemetry(
        'upload',
        () =>
          resilientUpload<T>(opts.url, opts.buildFormData(file), opts.headers, {
            fileSizeBytes: file.size,
            onAttempt: opts.onAttempt,
          }),
        { fileSizeBytes: file.size, fallbackLevel: level }
      );
      opts.onStage?.({ stage: 'upload', status: 'done' });
      return data;
    } catch (err) {
      opts.onStage?.({ stage: 'upload', status: 'error' });
      throw err;
    }
  };

  // Tentativa principal
  let lastError: unknown = null;
  try {
    const file = await compressForLevel(0);
    const data = await tryUpload(file, 0);
    return { data, fallbackLevel: 0, finalSize: file.size };
  } catch (err) {
    lastError = err;
  }

  // Fallback progressivo
  for (const recipe of FALLBACK_RECIPES) {
    try {
      opts.onStage?.({ stage: 'fallback', status: 'start' });
      const file = await compressForLevel(recipe.level, recipe);
      const data = await tryUpload(file, recipe.level);
      recordStageTelemetry({
        stage: 'fallback',
        success: true,
        latencyMs: 0,
        fileSizeBytes: file.size,
        fallbackLevel: recipe.level,
      });
      opts.onStage?.({ stage: 'fallback', status: 'done' });
      return { data, fallbackLevel: recipe.level, finalSize: file.size };
    } catch (err) {
      lastError = err;
      recordStageTelemetry({
        stage: 'fallback',
        success: false,
        latencyMs: 0,
        fileSizeBytes: rawFile.size,
        errorCode: (err as any)?.message?.slice(0, 200) || 'unknown',
        fallbackLevel: recipe.level,
      });
    }
  }

  throw lastError ?? new Error('upload_failed_after_fallbacks');
}
