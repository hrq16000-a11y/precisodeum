/**
 * uploadErrors — taxonomia padronizada de falhas de upload.
 *
 * Cada falha do pipeline (validação → resize → convert → compress → upload) é
 * classificada em uma de oito categorias. Isso permite:
 *   - Mensagens UX precisas ("erro ao converter" ≠ "tempo esgotado")
 *   - Telemetria correlacionável em `upload_test_results.error_kind`
 *   - Decisões de retry/fallback baseadas no tipo de falha
 */

import { UploadTimeoutError } from './uploadResilient';

export type UploadErrorKind =
  | 'timeout'      // Tempo da requisição excedido
  | 'network'      // Falha de rede (fetch falhou, sem conexão)
  | 'server'       // 5xx ou erro do edge `optimize-image`
  | 'convert'      // Canvas/codec não conseguiu produzir o blob de saída
  | 'compress'     // compressImage falhou (decodeImage, etc.)
  | 'aborted'      // Cancelado pelo usuário (AbortController explícito)
  | 'validation'   // Tipo/tamanho/dimensões inválidos antes de subir
  | 'unknown';

export const UPLOAD_ERROR_LABEL: Record<UploadErrorKind, string> = {
  timeout: 'Tempo esgotado durante o envio',
  network: 'Sem conexão de rede',
  server: 'Servidor instável (tente novamente)',
  convert: 'Erro ao converter formato da imagem',
  compress: 'Erro ao comprimir a imagem',
  aborted: 'Envio cancelado',
  validation: 'Arquivo inválido',
  unknown: 'Erro inesperado',
};

export class UploadAbortedError extends Error {
  constructor() {
    super('upload_aborted');
    this.name = 'UploadAbortedError';
  }
}

export class CompressionError extends Error {
  constructor(public readonly stage: 'resize' | 'convert' | 'compress', cause?: unknown) {
    super(`compression_failed_${stage}`);
    this.name = 'CompressionError';
    if (cause) (this as any).cause = cause;
  }
}

/**
 * Classifica um erro do pipeline em UploadErrorKind.
 * Aceita Error, string ou objeto opaco — sempre retorna algo.
 */
export function classifyUploadError(err: unknown): UploadErrorKind {
  if (err == null) return 'unknown';

  if (err instanceof UploadTimeoutError) return 'timeout';
  if (err instanceof UploadAbortedError) return 'aborted';
  if (err instanceof CompressionError) {
    return err.stage === 'convert' ? 'convert' : 'compress';
  }
  if (err instanceof TypeError) return 'network'; // fetch network failure

  const name = (err as any)?.name?.toLowerCase?.() ?? '';
  const msg = (err as any)?.message?.toLowerCase?.() ?? '';

  if (name === 'aborterror' || msg.includes('abort')) return 'aborted';
  if (msg.includes('timeout') || msg.includes('timed out')) return 'timeout';
  if (msg.includes('network') || msg.includes('failed to fetch')) return 'network';
  if (msg.includes('validation') || msg.includes('invalid_type') || msg.includes('too_large') || msg.includes('dim_')) {
    return 'validation';
  }
  if (msg.includes('compress')) return 'compress';
  if (msg.includes('convert') || msg.includes('decode')) return 'convert';

  // upload_status_5xx / upload_failed_5xx
  if (/upload_(status|failed)_5\d{2}/.test(msg)) return 'server';
  if (/upload_(status|failed)_4\d{2}/.test(msg)) return 'validation';

  return 'unknown';
}

/** Mensagem amigável pronta pra `toast.error()`. */
export function userMessageFor(kind: UploadErrorKind): string {
  switch (kind) {
    case 'timeout':
      return 'Conexão muito lenta. Toque em "Tentar novamente".';
    case 'network':
      return 'Sem rede. Verifique sua conexão e tente de novo.';
    case 'server':
      return 'Servidor instável. Aguarde um instante e tente novamente.';
    case 'convert':
      return 'Não conseguimos converter essa imagem. Tente outro formato (JPG/PNG).';
    case 'compress':
      return 'Falha ao otimizar a imagem. Tente uma foto menor.';
    case 'aborted':
      return 'Envio cancelado.';
    case 'validation':
      return 'Arquivo inválido — verifique tipo, tamanho e dimensões.';
    case 'unknown':
    default:
      return 'Erro ao enviar imagem. Toque em "Tentar novamente".';
  }
}
