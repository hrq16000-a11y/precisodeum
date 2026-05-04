/**
 * WorkingHoursPicker — UI controlada estilo Google Meu Negócio.
 *
 * - Presets de 1 clique (Comercial, Estendido, 24h, Fim de semana, Sob agendamento).
 * - "Personalizar" abre faixas: chips de dias (Seg–Dom) + select de hora início/fim.
 * - SEM texto livre. Toda alteração viaja como WorkingHoursStruct válido.
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Plus, Trash2, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  WORKING_HOURS_PRESETS,
  WEEKDAY_KEYS,
  applyPreset,
  detectPreset,
  formatStruct,
  keyToLabel,
  makeEmptyStruct,
  TIME_OPTIONS,
  TIME_OPTIONS_END,
  validateStruct,
  MAX_RANGES,
  type WeekdayKey,
  type WorkingHoursStruct,
} from './workingHours';

interface Props {
  value: WorkingHoursStruct | null;
  onChange: (next: WorkingHoursStruct) => void;
}

export const WorkingHoursPicker = ({ value, onChange }: Props) => {
  const safe: WorkingHoursStruct = value && Array.isArray(value.ranges) ? value : makeEmptyStruct();
  const [customMode, setCustomMode] = useState<boolean>(() => detectPreset(safe) === null);
  const activePreset = detectPreset(safe);
  // Accordion para presets secundários — fechado por padrão para não poluir.
  const [showOtherPresets, setShowOtherPresets] = useState(false);

  // Default automático: se o usuário entrou na etapa SEM nenhuma faixa
  // configurada, pré-seleciona "Comercial (Seg–Sex 08–18h)" para reduzir
  // fricção. Só dispara uma vez quando o struct está vazio.
  useEffect(() => {
    if (safe.ranges.length === 0 && activePreset === null) {
      onChange(applyPreset('commercial'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Se o usuário aplicou um preset, fechamos o ajuste fino automaticamente.
  useEffect(() => {
    if (activePreset && activePreset !== 'on_demand') setCustomMode(false);
  }, [activePreset]);


  const setStruct = (next: WorkingHoursStruct) => onChange(next);

  const addRange = () => {
    if (safe.ranges.length >= MAX_RANGES) return;
    // Heurística: oferece um default que não bate com a 1ª faixa para reduzir
    // conflito imediato. Ex.: se já existe Seg–Sex 08–18h, sugere Sáb 09–13h.
    const first = safe.ranges[0];
    let candidate: WorkingHoursStruct['ranges'][number] = {
      days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '08:00', end: '18:00',
    };
    if (first) {
      const firstIsWeekday = first.days.every((d) => ['mon', 'tue', 'wed', 'thu', 'fri'].includes(d));
      if (firstIsWeekday) {
        candidate = { days: ['sat'], start: '09:00', end: '13:00' };
      } else {
        candidate = { days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '08:00', end: '18:00' };
      }
    }
    const next: WorkingHoursStruct = { ranges: [...safe.ranges, candidate] };
    setStruct(next);
    setCustomMode(true);
  };

  const removeRange = (idx: number) => {
    const next: WorkingHoursStruct = { ranges: safe.ranges.filter((_, i) => i !== idx) };
    setStruct(next);
  };

  const updateRange = (idx: number, patch: Partial<WorkingHoursStruct['ranges'][number]>) => {
    const next: WorkingHoursStruct = {
      ranges: safe.ranges.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    };
    setStruct(next);
  };

  const toggleDay = (idx: number, day: WeekdayKey) => {
    const r = safe.ranges[idx];
    if (!r) return;
    const has = r.days.includes(day);
    const days = has ? r.days.filter((d) => d !== day) : [...r.days, day];
    updateRange(idx, { days });
  };

  const summary = formatStruct(safe);
  const issues = validateStruct(safe);
  const issuesByIndex = issues.reduce<Record<number, string[]>>((acc, it) => {
    if (!acc[it.index]) acc[it.index] = [];
    acc[it.index].push(it.message);
    return acc;
  }, {});
  const canAddMore = safe.ranges.length < MAX_RANGES;

  return (
    <div className="space-y-3">
      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        <Clock className="h-3.5 w-3.5" /> Horários de atendimento
      </span>

      {/* Presets */}
      <div className="flex flex-wrap gap-1.5">
        {WORKING_HOURS_PRESETS.map((p) => {
          const active = activePreset === p.id && !customMode;
          return (
            <motion.button
              key={p.id}
              type="button"
              onClick={() => {
                onChange(applyPreset(p.id));
                setCustomMode(false);
              }}
              whileTap={{ scale: 0.95 }}
              className={`rounded-full border px-3 py-1.5 text-xs transition ${
                active
                  ? 'border-emerald-500 bg-emerald-500/10 font-medium text-foreground'
                  : 'border-border hover:border-accent/50'
              }`}
              aria-pressed={active}
              title={p.description}
            >
              {p.label}
            </motion.button>
          );
        })}
      </div>

      {/* Toggle ajuste fino */}
      <button
        type="button"
        onClick={() => setCustomMode((v) => !v)}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
      >
        {customMode ? (
          <>
            <ChevronUp className="h-3 w-3" /> Ocultar ajuste fino
          </>
        ) : (
          <>
            <ChevronDown className="h-3 w-3" /> Personalizar (faixas por dia/hora)
          </>
        )}
      </button>

      {customMode && (
        <div className="space-y-3 rounded-lg border border-dashed border-border bg-muted/20 p-3">
          {safe.ranges.length === 0 && (
            <p className="text-[11px] text-muted-foreground">
              Nenhuma faixa ainda. Adicione uma para definir dias e horários personalizados.
            </p>
          )}

          {safe.ranges.map((r, idx) => {
            const rangeIssues = issuesByIndex[idx] || [];
            const hasErr = rangeIssues.length > 0;
            return (
            <div
              key={idx}
              className={`space-y-2 rounded-md border bg-card p-3 shadow-sm ${
                hasErr ? 'border-destructive/60 ring-1 ring-destructive/20' : 'border-border'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Faixa {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeRange(idx)}
                  className="inline-flex items-center gap-1 text-[11px] text-destructive hover:underline"
                  aria-label={`Remover faixa ${idx + 1}`}
                >
                  <Trash2 className="h-3 w-3" /> Remover
                </button>
              </div>

              {/* Dias */}
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAY_KEYS.map((d) => {
                  const active = r.days.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(idx, d)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                        active
                          ? 'border-emerald-500 bg-emerald-500/10 font-medium text-foreground'
                          : 'border-border hover:border-accent/50'
                      }`}
                      aria-pressed={active}
                    >
                      {keyToLabel(d)}
                    </button>
                  );
                })}
              </div>

              {/* Horas */}
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[11px]">
                  <span className="mb-1 block font-medium uppercase tracking-wide text-muted-foreground">
                    Início
                  </span>
                  <Select
                    value={r.start}
                    onValueChange={(v) => updateRange(idx, { start: v })}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {TIME_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="block text-[11px]">
                  <span className="mb-1 block font-medium uppercase tracking-wide text-muted-foreground">
                    Fim
                  </span>
                  <Select
                    value={r.end}
                    onValueChange={(v) => updateRange(idx, { end: v })}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {TIME_OPTIONS_END.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>
              {r.end < r.start && r.end !== '00:00' && r.end !== '24:00' && (
                <p className="text-[10px] text-amber-700 dark:text-amber-300">
                  Faixa cruzando meia-noite: {r.start} → {r.end} (entrará no filtro de "madrugada").
                </p>
              )}
              {rangeIssues.map((msg, k) => (
                <p key={k} className="flex items-start gap-1 text-[10.5px] font-medium text-destructive" style={{ textWrap: 'balance' as never }}>
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  <span className="break-words">{msg}</span>
                </p>
              ))}
            </div>
            );
          })}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRange}
            className="w-full"
            disabled={!canAddMore}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            {canAddMore
              ? `Adicionar outra faixa (${safe.ranges.length}/${MAX_RANGES})`
              : `Limite atingido — máximo ${MAX_RANGES} faixas`}
          </Button>
        </div>
      )}

      {summary && (
        <p className="text-[11px] leading-relaxed text-muted-foreground" style={{ textWrap: 'balance' as never, wordBreak: 'break-word' }}>
          Será exibido como{' '}
          <span className="font-medium text-foreground break-words">{summary}</span>
        </p>
      )}
      {!summary && (
        <p className="text-[11px] text-muted-foreground">
          Sem horário configurado — aparecerá como "Sob agendamento".
        </p>
      )}
      {issues.some((i) => i.type === 'overlap' || i.type === 'duplicate') && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-[11px] leading-snug text-destructive">
          <p className="font-medium">Conflito de horários detectado.</p>
          <p className="mt-0.5 text-foreground/80">
            Cada faixa precisa ser diferente em <strong>dia</strong> ou em <strong>horário</strong>.
            Ex.: válido — Seg–Sex 08:00–12:00 + Seg–Sex 13:00–18:00. Inválido — Seg–Sex 08:00–18:00 + Seg–Sex 08:00–19:00 (sobrepõem).
          </p>
        </div>
      )}
    </div>
  );
};

export default WorkingHoursPicker;
