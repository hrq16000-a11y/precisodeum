/**
 * Phase1 — O Mínimo para Existir.
 *
 * Padronizado abr/2026 com o visual do Bet Mode V3 (/cadastro-bet):
 * cards arredondados, CTAs gradiente âmbar→rosa, headers com chip,
 * inputs com brilho verde quando válidos. Sem emojis.
 *
 * Voltar/Avançar entre subfases NÃO perde dados (apenas troca `phase`
 * via reducer; profile/service permanecem no estado central).
 */

import { motion } from 'framer-motion';
import {
  Briefcase, UserRound, Building2, Megaphone, MapPin, Loader2, Phone,
  ArrowLeft, ArrowRight, Sparkles, User, Camera,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useGeoCity } from '@/hooks/useGeoCity';
import { useAuth } from '@/hooks/useAuth';
import CityAutocomplete from '@/components/CityAutocomplete';
import UFSelect, { BR_UFS } from '@/components/admin/UFSelect';
import { wizardStyles as ws, wizardEnter } from './wizardStyles';
import type { OnboardingCoreField, OnboardingProfileData, ProfileTypeChoice } from './types';

/* ───── 1.1 Atuação ───── */

interface ActionProps {
  onSelect: (type: ProfileTypeChoice) => void;
}

export const Phase1Action = ({ onSelect }: ActionProps) => {
  const cards = [
    { type: 'provider' as const, icon: Briefcase, title: 'Sou Profissional', desc: 'Quero ser encontrado por novos clientes' },
    { type: 'client' as const, icon: UserRound, title: 'Sou Cliente', desc: 'Procuro um profissional de confiança' },
    { type: 'rh' as const, icon: Building2, title: 'Agência de RH', desc: 'Recruto talentos para empresas' },
    { type: 'sponsor' as const, icon: Megaphone, title: 'Sou Patrocinador', desc: 'Quero anunciar minha marca' },
  ];
  return (
    <motion.div {...wizardEnter} className={ws.container} role="region" aria-labelledby="phase1-action-title">
      <header className={ws.headerWrap}>
        <div className={ws.chip}>
          <Sparkles className="h-3 w-3" aria-hidden="true" /> Cadastro express
        </div>
        <h1 id="phase1-action-title" className={ws.title}>Como você atua?</h1>
        <p className={ws.subtitle}>Em 4 passos rápidos a gente coloca você no mapa.</p>
      </header>
      <div className="grid gap-3" role="radiogroup" aria-labelledby="phase1-action-title">
        {cards.map(({ type, icon: Icon, title, desc }) => (
          <motion.button
            key={type}
            type="button"
            onClick={() => onSelect(type)}
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
            className={ws.selectCard}
            role="radio"
            aria-checked="false"
            aria-label={`${title}: ${desc}`}
          >
            <div className="flex items-center gap-4">
              <div className={ws.selectIcon}>
                <Icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="flex-1">
                <h3 className="font-display text-base font-extrabold text-foreground">{title}</h3>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-amber-500" aria-hidden="true" />
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

/* ───── 1.2 PF / PJ ───── */

interface KindProps {
  onSelect: (kind: 'pf' | 'pj') => void;
  onBack: () => void;
}

export const Phase1Kind = ({ onSelect, onBack }: KindProps) => (
  <motion.div {...wizardEnter} className={ws.container} role="region" aria-labelledby="phase1-kind-title">
    <button onClick={onBack} className={ws.backBtn} aria-label="Voltar para a etapa anterior">
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Voltar
    </button>
    <header className={ws.headerWrap}>
      <h1 id="phase1-kind-title" className={ws.title}>Como vamos te identificar?</h1>
      <p className={ws.subtitle}>Você poderá editar depois.</p>
    </header>
    <div className="grid gap-3" role="radiogroup" aria-labelledby="phase1-kind-title">
      <motion.button
        type="button"
        onClick={() => onSelect('pf')}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.985 }}
        className={ws.selectCard}
        role="radio"
        aria-checked="false"
        aria-label="Pessoa Física com CPF — profissional autônomo, sem CNPJ obrigatório"
      >
        <div className="flex items-center gap-4">
          <div className={ws.selectIcon}>
            <UserRound className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-base font-extrabold text-foreground">PF (CPF)</h3>
            <p className="text-xs text-muted-foreground">Profissional autônomo. Sem CNPJ obrigatório.</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </div>
      </motion.button>
      <motion.button
        type="button"
        onClick={() => onSelect('pj')}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.985 }}
        className={ws.selectCard}
        role="radio"
        aria-checked="false"
        aria-label="Pessoa Jurídica com CNPJ — empresa, MEI ou agência"
      >
        <div className="flex items-center gap-4">
          <div className={ws.selectIcon}>
            <Building2 className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-base font-extrabold text-foreground">PJ (CNPJ)</h3>
            <p className="text-xs text-muted-foreground">Empresa, MEI ou agência.</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </div>
      </motion.button>
    </div>
  </motion.div>
);

/* ───── 1.3 Localização + Foto ───── */

interface LocationProps {
  data: OnboardingProfileData;
  onChange: (patch: Partial<OnboardingProfileData>) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  locks?: Partial<Record<OnboardingCoreField, boolean>>;
}

function getInitials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase().slice(0, 2);
}

export const Phase1Location = ({ data, onChange, onNext, onBack, onSkip, locks }: LocationProps) => {
  const { user } = useAuth();
  const [requestingGps, setRequestingGps] = useState(false);
  const { requestPreciseLocation } = useGeoCity();
  const selectedStateName = BR_UFS.find((uf) => uf.uf === data.state)?.name;

  const socialAvatar = (user?.user_metadata as any)?.avatar_url || (user?.user_metadata as any)?.picture || null;
  const displayAvatar = data.avatar_url || socialAvatar;

  const handleGps = async () => {
    setRequestingGps(true);
    try {
      const r = await requestPreciseLocation({ force: true });
      if (r.ok && r.city) {
        onChange({ city: r.city, state: (r.state || '').toUpperCase().slice(0, 2) });
      }
    } finally {
      setRequestingGps(false);
    }
  };

  if (!data.avatar_url && socialAvatar) {
    onChange({ avatar_url: socialAvatar });
  }

  return (
    <motion.div {...wizardEnter} className={ws.container} role="region" aria-labelledby="phase1-location-title">
      <button onClick={onBack} className={ws.backBtn} aria-label="Voltar para a etapa anterior">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Voltar
      </button>
      <header className={ws.headerWrap}>
        <h1 id="phase1-location-title" className={ws.title}>De onde você atende?</h1>
        <p className={ws.subtitle}>Toque no botão abaixo — usamos seu GPS para acelerar.</p>
      </header>

      <div className="flex flex-col items-center gap-2">
        <Avatar className="h-24 w-24 ring-4 ring-amber-400/30 shadow-[0_0_24px_rgba(251,146,60,0.35)]">
          {displayAvatar ? <AvatarImage src={displayAvatar} alt={data.full_name || 'Você'} /> : null}
          <AvatarFallback className="bg-gradient-to-br from-amber-400 to-rose-500 text-white text-2xl font-display font-extrabold">
            {getInitials(data.full_name)}
          </AvatarFallback>
        </Avatar>
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Camera className="h-3 w-3" /> Sua foto pode ser ajustada depois.
        </p>
      </div>

      <Button type="button" size="lg" onClick={handleGps} disabled={requestingGps} className={ws.cta}>
        {requestingGps ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MapPin className="h-4 w-4 mr-2" />}
        {data.city ? `${data.city}${data.state ? ' • ' + data.state : ''} — atualizar` : 'Usar minha localização'}
      </Button>

      <div className={ws.card}>
        <label className="block">
          <span className={ws.fieldLabel}>
            <MapPin className="h-3.5 w-3.5" /> Estado
            {locks?.state && <span className={ws.pointsBadge}>preenchido</span>}
          </span>
          <UFSelect
            value={data.state}
            onChange={(uf) => {
              const nextUf = (uf || '').toUpperCase();
              onChange({ state: nextUf, city: nextUf === data.state ? data.city : '' });
            }}
            placeholder="Selecione o estado"
            className="w-full"
          />
        </label>

        <label className="block">
          <span className={ws.fieldLabel}>
            <MapPin className="h-3.5 w-3.5" /> Cidade
            {locks?.city && <span className={ws.pointsBadge}>preenchido</span>}
          </span>
          <CityAutocomplete
            value={{ city: data.city, state: data.state }}
            onChange={(next) => onChange({ city: next.city, state: next.state })}
            placeholder={data.state ? 'Selecione sua cidade' : 'Escolha o estado primeiro'}
            stateFilter={data.state}
            disabled={!data.state || !!locks?.city}
            statusText={selectedStateName ? `Mostrando cidades de ${selectedStateName}` : 'Selecione a UF para limitar as cidades'}
          />
          {!data.state && (
            <p className="mt-1 text-[11px] text-muted-foreground">Escolha a UF primeiro para limitar a busca da cidade.</p>
          )}
        </label>

        <label className="block">
          <span className={ws.fieldLabel}>
            <MapPin className="h-3.5 w-3.5" /> Bairro <span className="font-normal normal-case text-muted-foreground">(opcional)</span>
          </span>
          {(() => {
            const raw = data.neighborhood || '';
            const trimmed = raw.trim();
            const tooShort = trimmed.length > 0 && trimmed.length < 3;
            const invalidChars = trimmed.length > 0 && !/^[A-Za-zÀ-ÿ0-9\s.,'\-/]+$/.test(trimmed);
            const tooLong = trimmed.length > 80;
            const looksOk = trimmed.length >= 3 && !invalidChars && !tooLong;
            return (
              <>
                <input
                  type="text"
                  value={raw}
                  onChange={(e) => onChange({ neighborhood: e.target.value.slice(0, 80) })}
                  placeholder="Ex: Centro, Vila Mariana..."
                  maxLength={80}
                  aria-invalid={tooShort || invalidChars || tooLong}
                  className={`flex h-11 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:ring-2 ${
                    looksOk
                      ? 'border-emerald-500 ring-1 ring-emerald-300/40 focus:border-emerald-500 focus:ring-emerald-300/50'
                      : tooShort || invalidChars || tooLong
                        ? 'border-amber-400 focus:border-amber-500 focus:ring-amber-300/40'
                        : 'border-input focus:border-amber-400 focus:ring-amber-300/40'
                  }`}
                />
                {tooShort && (
                  <p className="mt-1 text-[11px] text-amber-600">Tente um nome com pelo menos 3 letras (não bloqueia avançar).</p>
                )}
                {invalidChars && (
                  <p className="mt-1 text-[11px] text-amber-600">Use apenas letras, números, espaços ou hífen.</p>
                )}
                {tooLong && (
                  <p className="mt-1 text-[11px] text-amber-600">Máximo 80 caracteres.</p>
                )}
              </>
            );
          })()}
        </label>
      </div>

      <div className="flex flex-col gap-2 pt-1">
        <Button type="button" size="lg" onClick={onNext} className={ws.cta}>
          Salvar e continuar <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
        <Button type="button" variant="ghost" onClick={onSkip} className={ws.ctaGhost}>
          Pular por enquanto
        </Button>
      </div>
    </motion.div>
  );
};

/* ───── 1.4 Nome + WhatsApp (OBRIGATÓRIO) ───── */

interface ContactProps {
  data: OnboardingProfileData;
  onChange: (patch: Partial<OnboardingProfileData>) => void;
  onSubmit: () => void;
  onBack: () => void;
  saving: boolean;
  locks?: Partial<Record<OnboardingCoreField, boolean>>;
  duplicateWhatsapp?: boolean;
  checkingWhatsapp?: boolean;
  onWhatsappBlur?: () => void;
}

/** Máscara visual: 41 9 9745 2053 (DDD + 9 + 4 + 4). */
function formatWhatsappVisible(digits: string): string {
  const d = (digits || '').replace(/\D/g, '').slice(-11);
  if (d.length < 3) return d;
  if (d.length < 4) return `${d.slice(0, 2)} ${d.slice(2)}`;
  if (d.length < 8) return `${d.slice(0, 2)} ${d.slice(2, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 2)} ${d.slice(2, 3)} ${d.slice(3, 7)} ${d.slice(7)}`;
}

export const Phase1Contact = ({
  data, onChange, onSubmit, onBack, saving,
  locks,
  duplicateWhatsapp = false, checkingWhatsapp = false, onWhatsappBlur,
}: ContactProps) => {
  const visibleWhats = useMemo(() => formatWhatsappVisible(data.whatsapp), [data.whatsapp]);
  const nameOk = data.full_name.trim().split(/\s+/).length >= 2 && data.full_name.trim().length >= 4;
  const whatsOk = (data.whatsapp || '').replace(/\D/g, '').length >= 10;
  const canSubmit = nameOk && whatsOk && !saving && !duplicateWhatsapp && !checkingWhatsapp;

  return (
    <motion.div {...wizardEnter} className={ws.container} role="region" aria-labelledby="phase1-contact-title">
      <button onClick={onBack} className={ws.backBtn} aria-label="Voltar para a etapa anterior">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Voltar
      </button>
      <header className={ws.headerWrap}>
        <div className={ws.chip}>
          <Sparkles className="h-3 w-3" aria-hidden="true" /> Quase lá
        </div>
        <h1 id="phase1-contact-title" className={ws.title}>Como te chamamos?</h1>
        <p className={ws.subtitle}>Só nome e WhatsApp — a parte chata acaba aqui.</p>
      </header>

      <div className={ws.card}>
        <label className="block">
          <span className={ws.fieldLabel}>
            <User className="h-3.5 w-3.5" /> Nome completo *
            {nameOk && <span className={ws.pointsBadge}>OK</span>}
          </span>
          <input
            type="text"
            autoComplete="name"
            value={data.full_name}
            onChange={(e) => onChange({ full_name: e.target.value })}
            placeholder="Ex: Maria Silva"
            disabled={!!locks?.full_name}
            autoFocus
            className={nameOk ? ws.inputValid : ws.input}
          />
          {!nameOk && data.full_name.length > 0 && (
            <p className="mt-1 text-xs text-destructive">Informe nome e sobrenome.</p>
          )}
        </label>

        <label className="block">
          <span className={ws.fieldLabel}>
            <Phone className="h-3.5 w-3.5" /> WhatsApp *
            {whatsOk && !duplicateWhatsapp && <span className={ws.pointsBadge}>OK</span>}
          </span>
          <div className="relative">
            <input
              type="tel"
              inputMode="numeric"
              value={visibleWhats}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                onChange({ whatsapp: digits });
              }}
              onBlur={onWhatsappBlur}
              placeholder="41 9 9745 2053"
              disabled={!!locks?.whatsapp}
              aria-invalid={duplicateWhatsapp || undefined}
              className={`${whatsOk && !duplicateWhatsapp ? ws.inputValid : ws.input} pr-24 tracking-wide ${
                duplicateWhatsapp ? 'border-destructive ring-destructive/40' : ''
              }`}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
              {checkingWhatsapp ? 'verificando...' : 'DDD + número'}
            </span>
          </div>
          {!whatsOk && data.whatsapp.length > 0 && (
            <p className="mt-1 text-xs text-destructive">Inclua DDD + número (mínimo 10 dígitos).</p>
          )}
          {duplicateWhatsapp && (
            <div role="alert" className="mt-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs">
              <p className="font-semibold text-destructive">
                Este WhatsApp já está vinculado a outra conta.
              </p>
              <p className="mt-1 text-muted-foreground">
                Cada número só pode pertencer a um perfil para garantir que o cliente fale com a pessoa certa.
              </p>
              <button
                type="button"
                onClick={() => onChange({ whatsapp: '' })}
                className="mt-2 inline-flex items-center text-[11px] font-semibold text-destructive underline-offset-2 hover:underline"
              >
                Limpar e digitar outro número
              </button>
            </div>
          )}
        </label>
      </div>

      <Button type="button" size="lg" onClick={onSubmit} disabled={!canSubmit} className={ws.cta}>
        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Salvar e continuar <ArrowRight className="ml-2 h-5 w-5" />
      </Button>
      <p className="text-center text-[10px] text-muted-foreground">
        Este passo não pode ser pulado — precisamos disso para te chamar de volta.
      </p>
    </motion.div>
  );
};
