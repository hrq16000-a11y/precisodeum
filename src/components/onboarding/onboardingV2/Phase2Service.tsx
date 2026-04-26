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
import { ChevronDown, X, Loader2, Plus, MapPin, Sparkles, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { suggestServiceDescription } from '@/lib/serviceDescriptionSuggester';
import { sanitizeSlug } from '@/lib/slugify';
import type { OnboardingFirstServiceData, OnboardingProfileData } from './types';

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
}

export const Phase2Service = ({
  service, profile, onChangeService, onChangeProfile, onNext, onBack, onSkip,
}: ServiceProps) => {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

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
    const text = suggestServiceDescription({
      categoryName: selectedName,
      categorySlug: slug,
      city: profile.city,
    });
    onChangeService({ description: text });
  };

  const canAdvance = !!selectedId && service.description.trim().length >= 10;

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground">← Voltar</button>
      <header className="text-center space-y-1">
        <h1 className="font-display text-2xl font-bold text-foreground">Qual serviço você quer cadastrar?</h1>
        <p className="text-sm text-muted-foreground">Em 30 segundos seu primeiro serviço já está no mapa.</p>
      </header>

      <div className="space-y-4">
        <div>
          <Label className="text-xs">Categoria *</Label>
          <div className="relative">
            <Input
              value={search || selectedName}
              onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              placeholder="Buscar categoria (ex: encanador, costureira...)"
            />
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
          {open && filtered.length > 0 && (
            <div className="mt-1 max-h-56 overflow-auto rounded-md border border-border bg-popover shadow-lg">
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
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Descrição do serviço *</Label>
            <button
              type="button"
              onClick={handleSuggest}
              disabled={!selectedId}
              className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent hover:bg-accent/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
              aria-label="Sugerir descrição com base na categoria"
            >
              <Sparkles className="h-3 w-3" />
              Sugerir descrição
            </button>
          </div>
          <textarea
            value={service.description}
            onChange={(e) => onChangeService({ description: e.target.value })}
            placeholder="Conte rapidamente o que você faz, diferenciais e experiência. Ex: Atendo emergências 24h, +10 anos de experiência em redes residenciais e comerciais."
            maxLength={400}
            rows={4}
            className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
          />
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-[10px] text-muted-foreground">
              {service.description.length}/400 — mínimo 10 caracteres. O título do anúncio será <span className="font-medium text-foreground">{selectedName || 'a categoria escolhida'}</span>.
            </p>
            {savedHint && (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600">
                <Check className="h-3 w-3" /> Salvo
              </span>
            )}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground/80">
            Dica: clique em <span className="font-medium">Sugerir descrição</span> para começar com um texto pronto e depois personalize do seu jeito.
          </p>
        </div>

        <p className="text-[10px] text-muted-foreground">
          Você poderá adicionar até 5 fotos no próximo passo.
        </p>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onSkip} className="flex-1">Pular por enquanto</Button>
        <Button type="button" onClick={onNext} disabled={!canAdvance} className="flex-1">Continuar</Button>
      </div>
    </div>
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
  const [cityDraft, setCityDraft] = useState('');
  const [priceText, setPriceText] = useState(service.starting_price_brl != null ? String(service.starting_price_brl) : '');

  // Pré-popula com cidade do perfil
  useEffect(() => {
    if (!service.cities_served.length && profile.city) {
      const tag = profile.state ? `${profile.city} - ${profile.state}` : profile.city;
      onChangeService({ cities_served: [tag] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addCity = (raw?: string) => {
    const v = (raw ?? cityDraft).trim();
    if (!v) return;
    if (service.cities_served.includes(v)) return;
    if (service.cities_served.length >= 5) return;
    onChangeService({ cities_served: [...service.cities_served, v] });
    setCityDraft('');
  };
  const removeCity = (v: string) => {
    onChangeService({ cities_served: service.cities_served.filter(c => c !== v) });
  };

  const setHours = (h: string) => {
    onChangeService({ working_hours: h });
    onChangeProfile({ working_hours: h }); // herança
  };

  const onPriceChange = (raw: string) => {
    const cleaned = raw.replace(/[^\d,.]/g, '').replace(',', '.');
    setPriceText(raw);
    const n = parseFloat(cleaned);
    onChangeService({ starting_price_brl: isNaN(n) ? null : n });
  };

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground">← Voltar</button>
      <header className="text-center space-y-1">
        <h1 className="font-display text-2xl font-bold text-foreground">Para quem e por quanto?</h1>
        <p className="text-sm text-muted-foreground">Tudo opcional — você pode refinar depois.</p>
      </header>

      {/* Cidades atendidas */}
      <div>
        <Label className="text-xs flex items-center gap-1">
          <MapPin className="h-3 w-3" /> Cidades atendidas <span className="text-muted-foreground">(até 5)</span>
        </Label>
        <div className="flex gap-2">
          <Input
            value={cityDraft}
            onChange={(e) => setCityDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCity(); } }}
            placeholder="Ex: Curitiba - PR"
            disabled={service.cities_served.length >= 5}
          />
          <Button type="button" variant="outline" onClick={() => addCity()} disabled={service.cities_served.length >= 5 || !cityDraft.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {service.cities_served.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
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

      {/* Valores (a partir de) — NUNCA "Orçamento" */}
      <div>
        <Label className="text-xs">Valores (a partir de)</Label>
        <Input
          value={priceText}
          onChange={(e) => onPriceChange(e.target.value)}
          inputMode="decimal"
          placeholder="Ex: 120,00"
        />
        {service.starting_price_brl != null && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Será exibido como <span className="font-medium text-foreground">{formatBRL(service.starting_price_brl)}</span>
          </p>
        )}
        <p className="mt-1 text-[10px] text-muted-foreground">Foco em valorizar sua mão de obra — nada de leilão.</p>
      </div>

      {/* Horários */}
      <div>
        <Label className="text-xs">Horários de atendimento</Label>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {HOUR_PRESETS.map(h => (
            <motion.button
              key={h}
              type="button"
              onClick={() => setHours(h)}
              whileTap={{ scale: 0.95 }}
              className={`rounded-full border px-3 py-1.5 text-xs transition ${service.working_hours === h ? 'border-accent bg-accent/15 font-medium' : 'border-border hover:border-accent/50'}`}
            >
              {h}
            </motion.button>
          ))}
        </div>
        <Input
          className="mt-2"
          value={service.working_hours}
          onChange={(e) => setHours(e.target.value)}
          placeholder="Ou descreva no seu jeito"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onSkip} disabled={saving} className="flex-1">Pular por enquanto</Button>
        <Button type="button" onClick={onSubmit} disabled={saving} className="flex-1">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Publicar serviço
        </Button>
      </div>
    </div>
  );
};
