/**
 * UploadProgressIndicator — barra com 4 etapas durante upload de imagem.
 *
 * Etapas: Validar → Redimensionar → Converter → Comprimir → Enviar (+ Retry).
 * Cada etapa exibe ícone (pendente/ativo/ok/erro) e, em caso de falha, o motivo
 * classificado (timeout/network/server/convert/compress/aborted/validation).
 * Layout compacto, mobile-first, usa apenas tokens semânticos.
 */

import { Loader2, Check, X, Circle, AlertTriangle } from 'lucide-react';
import type { UploadErrorKind } from '@/lib/uploadErrors';
import { UPLOAD_ERROR_LABEL } from '@/lib/uploadErrors';

export type UploadStageState = 'pending' | 'active' | 'done' | 'error';

export type UploadStageKey = 'validate' | 'resize' | 'convert' | 'compress' | 'upload' | 'retry';

export interface UploadStagesState {
  validate?: UploadStageState;
  resize: UploadStageState;
  convert: UploadStageState;
  compress: UploadStageState;
  upload: UploadStageState;
  retry?: UploadStageState;
  /** Motivo classificado quando uma etapa falhou. */
  errorStage?: UploadStageKey | null;
  errorKind?: UploadErrorKind | null;
  /** Mensagem livre sobreposta (ex.: "tempo esgotado, reenviando…"). */
  errorMessage?: string | null;
  /** 0..100 da etapa atual (usado em retry). */
  activePercent?: number;
}

const STAGE_ORDER: Array<{ key: Exclude<UploadStageKey, 'retry'>; label: string }> = [
  { key: 'validate', label: 'Validar' },
  { key: 'resize',   label: 'Redimensionar' },
  { key: 'convert',  label: 'Converter' },
  { key: 'compress', label: 'Comprimir' },
  { key: 'upload',   label: 'Enviar' },
];

export function makeInitialStages(): UploadStagesState {
  return {
    validate: 'done', // validação acontece antes do indicador aparecer
    resize: 'pending',
    convert: 'pending',
    compress: 'pending',
    upload: 'pending',
    retry: 'pending',
    errorStage: null,
    errorKind: null,
    errorMessage: null,
  };
}

interface Props {
  stages: UploadStagesState;
  className?: string;
}

const StageIcon = ({ state }: { state: UploadStageState }) => {
  if (state === 'active') return <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />;
  if (state === 'done')   return <Check className="h-3.5 w-3.5 text-success" />;
  if (state === 'error')  return <X className="h-3.5 w-3.5 text-destructive" />;
  return <Circle className="h-3.5 w-3.5 text-muted-foreground/70" />;
};

export function UploadProgressIndicator({ stages, className = '' }: Props) {
  const completed = STAGE_ORDER.filter((s) => stages[s.key] === 'done').length;
  const overall = Math.round((completed / STAGE_ORDER.length) * 100);
  const isRetrying = stages.retry === 'active';
  const errorKind = stages.errorKind ?? null;
  const errorMessage =
    stages.errorMessage ??
    (errorKind ? UPLOAD_ERROR_LABEL[errorKind] : null);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Processando imagem: ${overall}% completo`}
      className={`rounded-md border border-border bg-card/60 p-2 text-xs ${className}`}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-medium text-foreground">
          {isRetrying ? 'Tentando novamente…' : 'Processando imagem'}
        </span>
        <span className="tabular-nums text-muted-foreground">{overall}%</span>
      </div>

      {/* Barra geral */}
      <div className="mb-2 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full transition-[width] duration-300 ${
            errorKind ? 'bg-destructive' : 'bg-accent'
          }`}
          style={{ width: `${overall}%` }}
        />
      </div>

      {/* Lista de etapas */}
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-5">
        {STAGE_ORDER.map(({ key, label }) => {
          const state = stages[key] ?? 'pending';
          const isErrorStage = stages.errorStage === key;
          return (
            <li
              key={key}
              className={`flex items-center gap-1.5 ${
                state === 'active'
                  ? 'text-foreground'
                  : isErrorStage
                  ? 'text-destructive'
                  : 'text-muted-foreground'
              }`}
            >
              <StageIcon state={state} />
              <span className="truncate">{label}</span>
            </li>
          );
        })}
      </ul>

      {/* Mensagem específica do erro */}
      {errorMessage && (
        <div className="mt-2 flex items-start gap-1.5 rounded border border-destructive/30 bg-destructive/5 p-1.5 text-[11px] text-destructive">
          <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
          <span className="leading-tight">{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
