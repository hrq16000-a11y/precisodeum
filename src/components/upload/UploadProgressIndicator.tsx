/**
 * UploadProgressIndicator — barra com 4 etapas durante upload de imagem.
 *
 * Etapas: Redimensionar → Converter → Comprimir → Enviar.
 * Cada etapa exibe ícone (pendente/ativo/ok/erro) e percentual da etapa atual.
 * Layout compacto, mobile-first, usa apenas tokens semânticos.
 */

import { Loader2, Check, X, Circle } from 'lucide-react';

export type UploadStageState = 'pending' | 'active' | 'done' | 'error';

export interface UploadStagesState {
  resize: UploadStageState;
  convert: UploadStageState;
  compress: UploadStageState;
  upload: UploadStageState;
  /** 0..100 da etapa atual (usado no upload em modo retry). */
  activePercent?: number;
}

const STAGE_ORDER: Array<{ key: keyof Omit<UploadStagesState, 'activePercent'>; label: string }> = [
  { key: 'resize',   label: 'Redimensionar' },
  { key: 'convert',  label: 'Converter' },
  { key: 'compress', label: 'Comprimir' },
  { key: 'upload',   label: 'Enviar' },
];

export function makeInitialStages(): UploadStagesState {
  return { resize: 'pending', convert: 'pending', compress: 'pending', upload: 'pending' };
}

interface Props {
  stages: UploadStagesState;
  className?: string;
}

const StageIcon = ({ state }: { state: UploadStageState }) => {
  if (state === 'active') return <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />;
  if (state === 'done')   return <Check className="h-3.5 w-3.5 text-success" />;
  if (state === 'error')  return <X className="h-3.5 w-3.5 text-destructive" />;
  return <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />;
};

export function UploadProgressIndicator({ stages, className = '' }: Props) {
  const completed = STAGE_ORDER.filter((s) => stages[s.key] === 'done').length;
  const overall = Math.round((completed / STAGE_ORDER.length) * 100);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Processando imagem: ${overall}% completo`}
      className={`rounded-md border border-border bg-card/60 p-2 text-xs ${className}`}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-medium text-foreground">Processando imagem</span>
        <span className="tabular-nums text-muted-foreground">{overall}%</span>
      </div>

      {/* Barra geral */}
      <div className="mb-2 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-accent transition-[width] duration-300"
          style={{ width: `${overall}%` }}
        />
      </div>

      {/* Lista de etapas */}
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-4">
        {STAGE_ORDER.map(({ key, label }) => {
          const state = stages[key];
          return (
            <li
              key={key}
              className={`flex items-center gap-1.5 ${
                state === 'active' ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              <StageIcon state={state} />
              <span className="truncate">{label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
