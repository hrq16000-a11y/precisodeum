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
import { scheduleWizardTimeout } from '@/lib/wizardZombieGuard';
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
import { buildWorkingHoursSummary, formatStruct, legacyToStruct, validateStruct, type WorkingHoursStruct } from './workingHours';
import WorkingHoursPicker from './WorkingHoursPicker';
import ServiceCityPicker from './ServiceCityPicker';
import { useFocusFieldFromReview } from './useFocusFieldFromReview';
import { BackButton } from '@/components/onboarding/wizard/BackButton';

interface CategoryRow { id: string; name: string; icon?: string | null }

/* ───── 2.1 Categoria + Título ───── */

interface ServiceProps {
  service: OnboardingFirstServiceData;
  profile: OnboardingProfileData;
  onChangeService: (patch: Partial<OnboardingFirstServiceData>) => void;
  onChangeProfile: (patch: Partial<OnboardingProfileData>) => void;
  onNext: () => void;
  onBack: () => void;
  /**
   * @deprecated 2026-05-02 — o atalho "Salvar e configurar depois" foi
   * removido da UI desta fase para preservar a linearidade do funil
   * ("3 passos do 1º anúncio"). A prop é mantida na interface apenas
   * para compatibilidade com chamadores existentes; ela é IGNORADA.
   */
  onSkip?: () => void;
  /** Se já existe um service_id criado (não controla mais visibilidade na UI). */
  firstServiceId?: string | null;
}

export const Phase2Service = ({
  service, profile, onChangeService, onChangeProfile, onNext, onBack, firstServiceId,
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

  useEffect(() => {
    if (selectedId && selectedName && search !== selectedName) {
      setSearch(selectedName);
    }
  }, [search, selectedId, selectedName]);

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
  const hideHintTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!service.description) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    if (hideHintTimer.current) window.clearTimeout(hideHintTimer.current);
    setSavedHint(false);
    saveTimer.current = scheduleWizardTimeout(
      { phase: 'phase2_service', action: 'phase2_show_saved_hint' },
      () => {
        setSavedHint(true);
        // Clear blindado: o timer de "esconder" também é rastreado para
        // garantir limpeza no unmount (evita setState em componente morto).
        hideHintTimer.current = scheduleWizardTimeout(
          { phase: 'phase2_service', action: 'phase2_hide_saved_hint' },
          () => setSavedHint(false),
          1800,
        );
      },
      700,
    );
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      if (hideHintTimer.current) window.clearTimeout(hideHintTimer.current);
    };
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
  const advanceUnlockTimer = useRef<number | null>(null);
  // Cleanup do timer de unlock ao desmontar (evita timer zumbi após sair da fase).
  useEffect(() => () => {
    if (advanceUnlockTimer.current) window.clearTimeout(advanceUnlockTimer.current);
  }, []);

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
      if (advanceUnlockTimer.current) window.clearTimeout(advanceUnlockTimer.current);
      advanceUnlockTimer.current = scheduleWizardTimeout(
        { phase: 'phase2_service', action: 'phase2_advance_unlock', runIfStale: true },
        () => {
          advancingRef.current = false;
          advanceUnlockTimer.current = null;
        },
        600,
      );
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
      {/* BackButton removido — Voltar global vem do WizardShell. */}

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
              onChange={(e) => {
                const nextValue = e.target.value;
                setSearch(nextValue);
                setOpen(true);

                if (
                  selectedId &&
                  nextValue.trim().toLowerCase() !== selectedName.trim().toLowerCase()
                ) {
                  onChangeService({ category_ids: [], service_name: '' });
                  onChangeProfile({ primary_category_id: null });
                }
              }}
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
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground min-w-0">
              <FileText className="h-3.5 w-3.5 shrink-0" /> <span className="break-words">Descrição do serviço</span>
            </span>
            <button
              type="button"
              onClick={handleSuggest}
              disabled={!selectedId}
              className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent hover:bg-accent/20 disabled:opacity-40 disabled:cursor-not-allowed transition shrink-0"
              aria-label="Gerar 3 sugestões de descrição"
            >
              <Wand2 className="h-3 w-3 shrink-0" />
              <span className="whitespace-nowrap">Gerar 3 sugestões</span>
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

      {/*
        FLUXO LINEAR (correção 2026-05-02):
        O CTA principal "Salvar e continuar" SEMPRE avança para a próxima
        etapa interna do wizard (phase2_details → phase2_photos), nunca
        finaliza o cadastro nem redireciona para o dashboard. O botão
        secundário "Salvar progresso e configurar meu painel depois"
        foi REMOVIDO porque era redundante e confundia o usuário,
        quebrando a percepção de progresso linear ("3 passos do 1º
        anúncio"). O atalho de "pular tudo" continua disponível
        apenas no botão "Pular esta etapa" do topo (em modo revisão)
        e nos guards de saída — nunca como CTA inferior.
      */}
      <div className="flex flex-col gap-2 pt-1">
        <Button
          type="button"
          size="lg"
          onClick={handleAdvance}
          aria-disabled={!selectedId || !descriptionOk}
          className="group h-12 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500 text-base font-bold text-white shadow-[0_0_24px_rgba(251,146,60,0.55)] hover:opacity-95"
        >
          Salvar e continuar
          <ArrowRight className="ml-2 h-5 w-5 transition group-hover:translate-x-0.5" />
        </Button>
        {!firstServiceId && (
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

const formatBRL = (n: number | null): string => {
  if (n == null || isNaN(n)) return '';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
};

export const Phase2Details = ({
  service, profile, onChangeService, onChangeProfile, onSubmit, onBack, onSkip, saving,
}: DetailsProps) => {
  const [priceText, setPriceText] = useState(service.starting_price_brl != null ? String(service.starting_price_brl) : '');
  // Hidratação tardia: em modo revisão o `service.starting_price_brl` chega
  // depois que o componente monta (bootstrap remoto). Sem este efeito, o
  // input ficaria vazio mesmo com o valor correto no estado global, e o
  // próximo onBlur sobrescreveria o banco com null. Sincroniza apenas
  // quando o input está vazio E há valor no estado, NUNCA sobrescrevendo
  // edições do usuário em andamento.
  useEffect(() => {
    if (priceText !== '' || service.starting_price_brl == null) return;
    setPriceText(String(service.starting_price_brl));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service.starting_price_brl]);
  const focusCities = useFocusFieldFromReview('cities_served');

  // G13: dedupe defensivo de cliques em "Salvar e continuar".
  const submittingRef = useRef(false);
  const submitUnlockTimer = useRef<number | null>(null);
  // Cleanup do timer ao desmontar para evitar callback em componente morto.
  useEffect(() => () => {
    if (submitUnlockTimer.current) window.clearTimeout(submitUnlockTimer.current);
  }, []);
  const handleSubmitDeduped = () => {
    if (submittingRef.current || saving) return;
    submittingRef.current = true;
    try {
      onSubmit();
    } finally {
      if (submitUnlockTimer.current) window.clearTimeout(submitUnlockTimer.current);
      submitUnlockTimer.current = scheduleWizardTimeout(
        { phase: 'phase2_details', action: 'phase2_submit_unlock', runIfStale: true },
        () => {
          submittingRef.current = false;
          submitUnlockTimer.current = null;
        },
        1500,
      );
    }
  };

  // Pré-popula com cidade do perfil
  useEffect(() => {
    if (!service.cities_served.length && profile.city) {
      onChangeService({ cities_served: [profile.city] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hidrata struct a partir do legado (working_hours texto + working_days)
  // se o struct ainda estiver vazio. Garante migração transparente.
  useEffect(() => {
    if (service.working_hours_struct) return;
    const migrated = legacyToStruct(service.working_hours, service.working_days);
    if (migrated) onChangeService({ working_hours_struct: migrated });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setStruct = (next: WorkingHoursStruct) => {
    const summary = formatStruct(next);
    onChangeService({
      working_hours_struct: next,
      working_hours: summary,
    });
    onChangeProfile({ working_hours: summary }); // herança
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
      <BackButton onBack={onBack} />
      <header className="space-y-2 text-center">
        <h1 id="phase2-details-title" className="font-display text-lg font-extrabold leading-tight text-foreground">
          Para quem e por quanto?
        </h1>
        <p className="text-xs text-muted-foreground">Tudo opcional — você pode refinar depois.</p>
      </header>

      {/* Cidades atendidas com sugestão de Região Metropolitana */}
      <div
        ref={focusCities.ref as any}
        className={`rounded-xl border border-border bg-card p-3 shadow-card ${focusCities.highlightClass}`}
      >
        <ServiceCityPicker
          baseCity={profile.city}
          baseState={profile.state}
          value={service.cities_served}
          onChange={(next) => onChangeService({ cities_served: next })}
          max={5}
        />
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

      {/* Horários — picker estruturado (Google Meu Negócio) */}
      <div className="rounded-xl border border-border bg-card p-3 shadow-card">
        <WorkingHoursPicker
          value={(service.working_hours_struct as WorkingHoursStruct | null) ?? null}
          onChange={setStruct}
        />
      </div>

      {(() => {
        const hoursIssues = validateStruct((service.working_hours_struct as WorkingHoursStruct | null) ?? null);
        const blocked = hoursIssues.length > 0;
        return (
      <div className="flex flex-col gap-2 pt-1">
        <Button
          type="button"
          size="lg"
          onClick={handleSubmitDeduped}
          disabled={saving || blocked}
          className="group h-12 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500 text-base font-bold text-white shadow-[0_0_24px_rgba(251,146,60,0.55)] hover:opacity-95 disabled:opacity-50 disabled:shadow-none"
        >
          {saving && <Loader2 className="h-5 w-5 mr-2 animate-spin" />}
          {blocked ? 'Corrija os horários para continuar' : 'Salvar e continuar'}
          {!saving && !blocked && <ArrowRight className="ml-2 h-5 w-5 transition group-hover:translate-x-0.5" />}
        </Button>
        <Button type="button" variant="ghost" onClick={onSkip} disabled={saving} className="w-full text-muted-foreground">
          Salvar e adicionar fotos depois
        </Button>
      </div>
        );
      })()}
    </motion.div>
  );
};

