/**
 * WorkingHoursPicker — UI controlada estilo Google Meu Negócio.
 *
 * - Presets de 1 clique (Comercial, Estendido, 24h, Fim de semana, Sob agendamento).
 * - "Personalizar" abre faixas: chips de dias (Seg–Dom) + select de hora início/fim.
 * - SEM texto livre. Toda alteração viaja como WorkingHoursStruct válido.
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
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

  // Se o usuário aplicou um preset, fechamos o ajuste fino automaticamente.
  useEffect(() => {
    if (activePreset && activePreset !== 'on_demand') setCustomMode(false);
  }, [activePreset]);

  const setStruct = (next: WorkingHoursStruct) => onChange(next);

  const addRange = () => {
    const next: WorkingHoursStruct = {
      ranges: [
        ...safe.ranges,
        { days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '08:00', end: '18:00' },
      ],
    };
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

          {safe.ranges.map((r, idx) => (
            <div key={idx} className="space-y-2 rounded-md border border-border bg-card p-3 shadow-sm">
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
              {r.end < r.start && r.end !== '00:00' && (
                <p className="text-[10px] text-amber-700 dark:text-amber-300">
                  Faixa cruzando meia-noite: {r.start} → {r.end} (entrará no filtro de "madrugada").
                </p>
              )}
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRange}
            className="w-full"
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar outra faixa
          </Button>
        </div>
      )}

      {summary && (
        <p className="text-[11px] text-muted-foreground">
          Será exibido como <span className="font-medium text-foreground">{summary}</span>
        </p>
      )}
      {!summary && (
        <p className="text-[11px] text-muted-foreground">
          Sem horário configurado — aparecerá como "Sob agendamento".
        </p>
      )}
    </div>
  );
};

export default WorkingHoursPicker;
