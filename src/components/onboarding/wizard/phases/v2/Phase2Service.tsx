/**
 * Phase2 — Criação Expressa do 1º Serviço (Time-to-Value).
 *
 * Sub-passos:
 *  5. Categoria + Título do serviço (obrigatórios para criar)
 *  6. Cidades atendidas (≤5), "Valores (a partir de)", Horários
 *
 * "Regra de Ouro": Categoria + Horário herdam para o perfil do usuário,
 * achatando perguntas futuras na Fase 4.
 *
 * NUNCA usar a palavra "Orçamento" — sempre "Valores (a partir de)".
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, X, Loader2, Plus, MapPin, Sparkles, Check, AlertCircle, Wand2, ArrowRight, Tag, FileText, DollarSign, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import CityAutocomplete from '@/components/CityAutocomplete';
import { supabase } from '@/integrations/supabase/client';
import { suggestServiceDescriptionVariants } from '@/lib/serviceDescriptionSuggester';
import { sanitizeSlug } from '@/lib/slugify';
import type { OnboardingFirstServiceData, OnboardingProfileData } from './types';
import { WEEKDAY_OPTIONS, buildWorkingHoursSummary } from './workingHours';
import { useFocusFieldFromReview } from './useFocusFieldFromReview';

interface CategoryRow { id: string; name: string; icon?: string | null }

/* ───── 2.1 Categoria + Título ───── */

interface ServiceProps {
  service: OnboardingFirstServiceData;
  profile: OnboardingProfileData;
  onChangeService: (patch: Partial<OnboardingFirstServiceData>) => void;
  onChangeProfile: (patch: Partial<OnboardingProfileData>) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  /** Se já existe um service_id criado, libera o "Salvar progresso e configurar depois". */
  firstServiceId?: string | null;
}

export const Phase2Service = ({
  service, profile, onChangeService, onChangeProfile, onNext, onBack, onSkip, firstServiceId,
}: ServiceProps) => {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const focusCategory = useFocusFieldFromReview('service_name');

  useEffect(() => {
    let mounted = true;
    supabase.from('categories').select('id, name, icon').order('name').then(({ data }) => {
      if (mounted && data) setCategories(data as any);
    });
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? categories.filter(c => c.name.toLowerCase().includes(q)) : categories;
    return list.slice(0, 50);
  }, [categories, search]);

  const selectedId = service.category_ids[0] || null;
  const selectedName = useMemo(
    () => categories.find(c => c.id === selectedId)?.name || '',
    [categories, selectedId],
  );

  const pickCategory = (id: string, name: string) => {
    // INVARIANTE: o nome do serviço é SEMPRE o nome da categoria escolhida,
    // e o primary_category_id do perfil herda esse mesmo id.
    onChangeService({ category_ids: [id], service_name: name });
    onChangeProfile({ primary_category_id: id });
    setOpen(false);
    setSearch(name);
  };

  // Auto-save discreto: o estado já é persistido em localStorage + remoto via
  // hooks no Shell (useOnboardingV2Draft / useOnboardingV2RemoteDraft) com debounce.
  // Aqui exibimos um micro-indicador visual quando o usuário pausa a digitação.
  const [savedHint, setSavedHint] = useState(false);
  const saveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!service.description) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    setSavedHint(false);
    saveTimer.current = window.setTimeout(() => {
      setSavedHint(true);
      window.setTimeout(() => setSavedHint(false), 1800);
    }, 700);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, [service.description]);

  const handleSuggest = () => {
    const slug = selectedId ? sanitizeSlug(selectedName) : '';
    const list = suggestServiceDescriptionVariants({
      categoryName: selectedName,
      categorySlug: slug,
      city: profile.city,
      neighborhood: profile.neighborhood,
    });
    setVariants(list);
    if (list[0]) onChangeService({ description: list[0] });
    setSelectedVariantIdx(0);
  };

  const [variants, setVariants] = useState<string[]>([]);
  const [selectedVariantIdx, setSelectedVariantIdx] = useState<number | null>(null);

  const pickVariant = (idx: number) => {
    const text = variants[idx];
    if (!text) return;
    setSelectedVariantIdx(idx);
    onChangeService({ description: text });
  };

  // Invariante: o nome do serviço deve refletir a categoria selecionada e o
  // primary_category_id do perfil deve apontar para o mesmo id. G13: a invariante
  // continua sendo a verdade final, mas o avanço NÃO depende mais dela — se o
  // usuário tem categoria + descrição válidas, normalizamos automaticamente
  // o nome no clique e seguimos. O botão nunca fica "morto sem explicação".
  const invariantOk =
    !!selectedId &&
    service.service_name.trim().toLowerCase() === selectedName.trim().toLowerCase() &&
    profile.primary_category_id === selectedId;

  const descriptionOk = service.description.trim().length >= 10;

  // G13: dedupe de cliques no botão "Salvar e continuar".
  const advancingRef = useRef(false);

  const handleAdvance = () => {
    if (advancingRef.current) return;
    if (!selectedId) {
      toast.error('Por favor, selecione uma categoria de serviço para continuar.');
      return;
    }
    if (!descriptionOk) {
      toast.error('Escreva uma descrição com pelo menos 10 caracteres para o seu serviço.');
      return;
    }
    if (!invariantOk) {
      // Auto-corrige no clique (sem bloquear): alinhamos service_name +
      // primary_category_id à categoria escolhida e seguimos para o próximo passo.
      onChangeService({ category_ids: [selectedId], service_name: selectedName });
      onChangeProfile({ primary_category_id: selectedId });
    }
    advancingRef.current = true;
    try {
      onNext();
    } finally {
      // Libera o lock no próximo tick — o shell já avançou de phase, mas
      // protegemos contra duplo-clique muito rápido.
      window.setTimeout(() => { advancingRef.current = false; }, 600);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto w-full max-w-md space-y-3 px-4 py-3"
      role="region"
      aria-labelledby="phase2-service-title"
    >
      <button
        onClick={onBack}
        className="text-xs text-muted-foreground hover:text-foreground"
        aria-label="Voltar para a etapa anterior"
      >
        ← Voltar
      </button>
      <header className="space-y-2 text-center">
        <h1 id="phase2-service-title" className="font-display text-lg font-extrabold leading-tight text-foreground">
          Qual serviço você quer cadastrar?
        </h1>
        <p className="text-xs text-muted-foreground">
          Em 30 segundos seu primeiro serviço já está no mapa.
        </p>
      </header>

      <div className="space-y-2 rounded-xl border border-border bg-card p-3 shadow-card">
        <label className="block">
          <span className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <Tag className="h-3.5 w-3.5" /> Categoria
          </span>
          <div className="relative">
            <Input
              ref={focusCategory.ref as any}
              className={`h-11 ${focusCategory.highlightClass}`}
              value={search || selectedName}
              onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              placeholder="Buscar categoria (ex: encanador, costureira...)"
            />
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
          {open && filtered.length > 0 && (
            <div className="mt-1 max-h-56 overflow-auto rounded-lg border border-border bg-popover shadow-lg">
              {filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pickCategory(c.id, c.name)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent/10 ${selectedId === c.id ? 'bg-accent/15 font-medium' : ''}`}
                >
                  <span>{c.name}</span>
                  {selectedId === c.id && <Badge variant="secondary" className="text-[10px]">Selecionada</Badge>}
                </button>
              ))}
            </div>
          )}
          {selectedId && !invariantOk && (
            <p className="mt-1 inline-flex items-start gap-1 text-[11px] text-amber-700 dark:text-amber-300">
              <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
              O título do serviço será ajustado para "{selectedName}" ao continuar.
            </p>
          )}
        </label>

        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <FileText className="h-3.5 w-3.5" /> Descrição do serviço
            </span>
            <button
              type="button"
              onClick={handleSuggest}
              disabled={!selectedId}
              className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent hover:bg-accent/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
              aria-label="Gerar 3 sugestões de descrição"
            >
              <Wand2 className="h-3 w-3" />
              Gerar 3 sugestões
            </button>
          </div>

          {variants.length > 0 && (
            <div className="mt-1 grid gap-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Escolha uma variação ou edite à vontade</p>
              <div className="flex flex-wrap gap-1.5">
                {variants.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => pickVariant(idx)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition ${
                      selectedVariantIdx === idx
                        ? 'border-accent bg-accent/15 font-medium text-foreground'
                        : 'border-border hover:border-accent/50 text-muted-foreground'
                    }`}
                  >
                    <Sparkles className="h-3 w-3" /> Variação {idx + 1}
                  </button>
                ))}
              </div>
            </div>
          )}

          <textarea
            value={service.description}
            onChange={(e) => { onChangeService({ description: e.target.value }); setSelectedVariantIdx(null); }}
            placeholder="Conte rapidamente o que você faz, diferenciais e experiência. Ex: Atendo emergências 24h, +10 anos de experiência em redes residenciais e comerciais."
            maxLength={400}
            rows={4}
            className={`mt-2 flex w-full rounded-lg border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:ring-2 resize-none ${
              service.description.trim().length >= 10
                ? 'border-emerald-500 ring-2 ring-emerald-300/50 shadow-[0_0_14px_rgba(16,185,129,0.35)] focus:border-emerald-500 focus:ring-emerald-300/50'
                : 'border-input focus:border-amber-400 focus:ring-amber-300/40'
            }`}
          />
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-[10px] text-muted-foreground">
              {service.description.length}/400 — mínimo 10 caracteres.
            </p>
            {savedHint && (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600">
                <Check className="h-3 w-3" /> Salvo
              </span>
            )}
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Você poderá adicionar até 5 fotos no próximo passo.
        </p>
      </div>

      <div className="flex flex-col gap-2 pt-1">
        <Button
          type="button"
          size="lg"
          onClick={handleAdvance}
          aria-disabled={!selectedId || !descriptionOk}
          className="group h-12 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-base font-bold text-white shadow-[0_0_24px_rgba(251,146,60,0.55)] hover:opacity-95"
        >
          Salvar e continuar
          <ArrowRight className="ml-2 h-5 w-5 transition group-hover:translate-x-0.5" />
        </Button>
        {firstServiceId ? (
          // Milestone OK — usuário JÁ tem um serviço publicado: pode salvar e ir pro painel.
          <Button
            type="button"
            variant="ghost"
            onClick={onSkip}
            className="w-full text-muted-foreground"
          >
            Salvar progresso e configurar meu painel depois
          </Button>
        ) : (
          // Milestone bloqueado — explica em vez de esconder, para reduzir frustração.
          <div className="rounded-md border border-amber-200 bg-amber-50/60 p-2 text-center text-[11px] leading-snug text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
            Falta pouco! Publique seu primeiro serviço para que os clientes já
            possam te encontrar enquanto você termina o resto depois.
          </div>
        )}
      </div>
    </motion.div>
  );
};

/* ───── 2.2 Detalhes (Cidades / Valores / Horários) ───── */

interface DetailsProps {
  service: OnboardingFirstServiceData;
  profile: OnboardingProfileData;
  onChangeService: (patch: Partial<OnboardingFirstServiceData>) => void;
  onChangeProfile: (patch: Partial<OnboardingProfileData>) => void;
  onSubmit: () => void;
  onBack: () => void;
  onSkip: () => void;
  saving: boolean;
}

const HOUR_PRESETS = [
  'Comercial (09h às 18h)',
  '24 horas',
  'Sob agendamento',
  'Finais de semana',
];

const formatBRL = (n: number | null): string => {
  if (n == null || isNaN(n)) return '';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
};

export const Phase2Details = ({
  service, profile, onChangeService, onChangeProfile, onSubmit, onBack, onSkip, saving,
}: DetailsProps) => {
  const [priceText, setPriceText] = useState(service.starting_price_brl != null ? String(service.starting_price_brl) : '');
  const [customHours, setCustomHours] = useState(service.working_hours);
  const focusCities = useFocusFieldFromReview('cities_served');

  // G13: dedupe defensivo de cliques em "Salvar e continuar".
  const submittingRef = useRef(false);
  const handleSubmitDeduped = () => {
    if (submittingRef.current || saving) return;
    submittingRef.current = true;
    try {
      onSubmit();
    } finally {
      window.setTimeout(() => { submittingRef.current = false; }, 1500);
    }
  };

  // Pré-popula com cidade do perfil
  useEffect(() => {
    if (!service.cities_served.length && profile.city) {
      onChangeService({ cities_served: [profile.city] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addCity = (city: string) => {
    const v = city.trim();
    if (!v) return;
    if (service.cities_served.includes(v)) return;
    if (service.cities_served.length >= 5) return;
    onChangeService({ cities_served: [...service.cities_served, v] });
  };
  const removeCity = (v: string) => {
    onChangeService({ cities_served: service.cities_served.filter(c => c !== v) });
  };

  const setHours = (h: string) => {
    setCustomHours(h);
    const summary = buildWorkingHoursSummary(h, service.working_days);
    onChangeService({ working_hours: h });
    onChangeProfile({ working_hours: summary }); // herança
  };

  const toggleDay = (day: string) => {
    const nextDays = service.working_days.includes(day)
      ? service.working_days.filter((current) => current !== day)
      : [...service.working_days, day];

    const summary = buildWorkingHoursSummary(customHours, nextDays);
    onChangeService({ working_days: nextDays });
    onChangeProfile({ working_hours: summary });
  };

  const onPriceChange = (raw: string) => {
    const cleaned = raw.replace(/[^\d,.]/g, '').replace(',', '.');
    setPriceText(raw);
    const n = parseFloat(cleaned);
    onChangeService({ starting_price_brl: isNaN(n) ? null : n });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto w-full max-w-md space-y-3 px-4 py-3"
      role="region"
      aria-labelledby="phase2-details-title"
    >
      <button
        onClick={onBack}
        className="text-xs text-muted-foreground hover:text-foreground"
        aria-label="Voltar para a etapa anterior"
      >
        ← Voltar
      </button>
      <header className="space-y-2 text-center">
        <h1 id="phase2-details-title" className="font-display text-lg font-extrabold leading-tight text-foreground">
          Para quem e por quanto?
        </h1>
        <p className="text-xs text-muted-foreground">Tudo opcional — você pode refinar depois.</p>
      </header>

      {/* Cidades atendidas */}
      <div
        ref={focusCities.ref as any}
        className={`space-y-2 rounded-xl border border-border bg-card p-3 shadow-card ${focusCities.highlightClass}`}
      >
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" /> Cidades atendidas <span className="font-normal normal-case text-muted-foreground/70">(até 5)</span>
        </span>
        <div className="flex gap-2">
          <div className="flex-1">
            <CityAutocomplete
              value={{ city: '', state: profile.state }}
              onChange={(next) => addCity(next.city)}
              placeholder={profile.state ? 'Ex: Curitiba' : 'Defina sua UF antes'}
              stateFilter={profile.state}
              disabled={service.cities_served.length >= 5 || !profile.state}
              statusText={profile.state ? `Selecione cidades de ${profile.state}` : 'A UF do perfil define as cidades exibidas'}
            />
          </div>
          <Button type="button" variant="outline" disabled className="h-11 w-11 p-0">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {!profile.state && (
          <p className="text-[11px] text-muted-foreground">Escolha seu estado na etapa anterior para limitar as cidades automaticamente.</p>
        )}
        {service.cities_served.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {service.cities_served.map(c => (
              <Badge key={c} variant="secondary" className="gap-1">
                {c}
                <button type="button" onClick={() => removeCity(c)} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Valores (a partir de) */}
      <div className="space-y-2 rounded-xl border border-border bg-card p-3 shadow-card">
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <DollarSign className="h-3.5 w-3.5" /> Valores (a partir de)
        </span>
        <Input
          value={priceText}
          onChange={(e) => onPriceChange(e.target.value)}
          inputMode="decimal"
          placeholder="Ex: 120,00"
          className="h-11"
        />
        {service.starting_price_brl != null && (
          <p className="text-[11px] text-muted-foreground">
            Será exibido como <span className="font-medium text-foreground">{formatBRL(service.starting_price_brl)}</span>
          </p>
        )}
        <p className="text-[11px] leading-relaxed text-muted-foreground">Foco em valorizar sua mão de obra — nada de leilão.</p>
      </div>

      {/* Horários */}
      <div className="space-y-2 rounded-xl border border-border bg-card p-3 shadow-card">
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> Horários de atendimento
        </span>
        <div className="flex flex-wrap gap-1.5">
          {HOUR_PRESETS.map(h => (
            <motion.button
              key={h}
              type="button"
              onClick={() => setHours(h)}
              whileTap={{ scale: 0.95 }}
              className={`rounded-full border px-3 py-1.5 text-xs transition ${customHours === h ? 'border-emerald-500 bg-emerald-500/10 font-medium text-foreground' : 'border-border hover:border-accent/50'}`}
            >
              {h}
            </motion.button>
          ))}
        </div>
        <div>
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Dias de atendimento</span>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_OPTIONS.map((day) => {
              const active = service.working_days.includes(day);
              return (
                <motion.button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  whileTap={{ scale: 0.95 }}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${active ? 'border-emerald-500 bg-emerald-500/10 font-medium text-foreground' : 'border-border hover:border-accent/50'}`}
                >
                  {day}
                </motion.button>
              );
            })}
          </div>
        </div>
        <Input
          value={customHours}
          onChange={(e) => setHours(e.target.value)}
          placeholder="Ou descreva no seu jeito"
          className="h-11"
        />
        {(service.working_days.length > 0 || customHours.trim()) && (
          <p className="text-[11px] text-muted-foreground">
            Será exibido como <span className="font-medium text-foreground">{buildWorkingHoursSummary(customHours, service.working_days)}</span>
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 pt-1">
        <Button
          type="button"
          size="lg"
          onClick={onSubmit}
          disabled={saving}
          className="group h-12 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-base font-bold text-white shadow-[0_0_24px_rgba(251,146,60,0.55)] hover:opacity-95 disabled:opacity-50 disabled:shadow-none"
        >
          {saving && <Loader2 className="h-5 w-5 mr-2 animate-spin" />}
          Salvar e continuar
          {!saving && <ArrowRight className="ml-2 h-5 w-5 transition group-hover:translate-x-0.5" />}
        </Button>
        <Button type="button" variant="ghost" onClick={onSkip} disabled={saving} className="w-full text-muted-foreground">
          Salvar progresso e configurar meu painel depois
        </Button>
      </div>
    </motion.div>
  );
};
