/**
 * Phase1 — O Mínimo para Existir.
 *
 * 4 sub-passos curtíssimos:
 *  1. Atuação (cards: profissional / cliente / RH / patrocinador)
 *  2. PF (CPF) ou PJ (CNPJ)
 *  3. Localização (GPS) + Foto (Google avatar / inicial elegante)
 *  4. Nome completo + WhatsApp (com máscara visual)
 *
 * ⚠ Apenas o sub-passo 4 é obrigatório (regra do prompt).
 */

import { motion } from 'framer-motion';
import { Briefcase, UserRound, Building2, Megaphone, MapPin, Camera, Loader2, Phone } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useGeoCity } from '@/hooks/useGeoCity';
import { useAuth } from '@/hooks/useAuth';
import type { OnboardingCoreField, OnboardingProfileData, ProfileTypeChoice } from './types';

/* ───── 1.1 Atuação ───── */

interface ActionProps {
  onSelect: (type: ProfileTypeChoice) => void;
}
const TONES: Record<string, string> = {
  accent: 'border-accent/30 bg-accent/5 hover:border-accent',
  blue: 'border-blue-500/30 bg-blue-500/5 hover:border-blue-500',
  purple: 'border-purple-500/30 bg-purple-500/5 hover:border-purple-500',
  secondary: 'border-secondary/30 bg-secondary/5 hover:border-secondary',
};

export const Phase1Action = ({ onSelect }: ActionProps) => {
  const cards = [
    { type: 'provider' as const, icon: Briefcase, title: 'Sou Profissional', desc: 'Quero ser encontrado por novos clientes', tone: 'accent' },
    { type: 'client' as const, icon: UserRound, title: 'Sou Cliente', desc: 'Procuro um profissional de confiança', tone: 'blue' },
    { type: 'rh' as const, icon: Building2, title: 'Agência de RH', desc: 'Recruto talentos para empresas', tone: 'purple' },
    { type: 'sponsor' as const, icon: Megaphone, title: 'Sou Patrocinador', desc: 'Quero anunciar minha marca', tone: 'secondary' },
  ];
  return (
    <div className="space-y-5">
      <header className="text-center space-y-1">
        <h1 className="font-display text-2xl font-bold text-foreground">Como você atua?</h1>
        <p className="text-sm text-muted-foreground">Em 4 passos rápidos a gente coloca você no mapa.</p>
      </header>
      <div className="grid gap-3">
        {cards.map(({ type, icon: Icon, title, desc, tone }) => (
          <motion.button
            key={type}
            type="button"
            onClick={() => onSelect(type)}
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
            className={`rounded-2xl border-2 p-5 text-left shadow-sm transition-colors hover:shadow-lg ${TONES[tone]}`}
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-foreground/5">
                <Icon className="h-6 w-6 text-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-display text-base font-bold text-foreground">{title}</h3>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

/* ───── 1.2 PF / PJ ───── */

interface KindProps {
  onSelect: (kind: 'pf' | 'pj') => void;
  onBack: () => void;
}

export const Phase1Kind = ({ onSelect, onBack }: KindProps) => (
  <div className="space-y-5">
    <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground">← Voltar</button>
    <header className="text-center space-y-1">
      <h1 className="font-display text-2xl font-bold text-foreground">Como vamos te identificar?</h1>
      <p className="text-sm text-muted-foreground">Você poderá editar depois.</p>
    </header>
    <div className="grid gap-3">
      <motion.button
        type="button"
        onClick={() => onSelect('pf')}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.985 }}
        className="rounded-2xl border-2 border-accent/30 bg-accent/5 p-5 text-left hover:border-accent hover:shadow-lg transition"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <UserRound className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-base font-bold text-foreground">PF (CPF)</h3>
            <p className="text-xs text-muted-foreground">Profissional autônomo. Sem CNPJ obrigatório.</p>
          </div>
        </div>
      </motion.button>
      <motion.button
        type="button"
        onClick={() => onSelect('pj')}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.985 }}
        className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-5 text-left hover:border-primary hover:shadow-lg transition"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-base font-bold text-foreground">PJ (CNPJ)</h3>
            <p className="text-xs text-muted-foreground">Empresa, MEI ou agência.</p>
          </div>
        </div>
      </motion.button>
    </div>
  </div>
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

  // Avatar fallback: usa Google avatar do auth, se houver.
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

  // Se ainda não temos avatar próprio mas temos do Google, sincroniza ao montar.
  if (!data.avatar_url && socialAvatar) {
    onChange({ avatar_url: socialAvatar });
  }

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground">← Voltar</button>
      <header className="text-center space-y-1">
        <h1 className="font-display text-2xl font-bold text-foreground">De onde você atende?</h1>
        <p className="text-sm text-muted-foreground">Toque no botão abaixo — usamos seu GPS para acelerar.</p>
      </header>

      <div className="flex flex-col items-center gap-3">
        <Avatar className="h-24 w-24 ring-4 ring-accent/20">
          {displayAvatar ? (
            <AvatarImage src={displayAvatar} alt={data.full_name || 'Você'} />
          ) : null}
          <AvatarFallback className="bg-accent text-accent-foreground text-2xl font-display font-bold">
            {getInitials(data.full_name)}
          </AvatarFallback>
        </Avatar>
        <p className="text-xs text-muted-foreground">Sua foto pode ser ajustada depois.</p>
      </div>

      <Button
        type="button"
        size="lg"
        onClick={handleGps}
        disabled={requestingGps}
        className="w-full"
      >
        {requestingGps ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MapPin className="h-4 w-4 mr-2" />}
        {data.city ? `${data.city}${data.state ? ' • ' + data.state : ''} — atualizar` : 'Usar minha localização'}
      </Button>

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <Label className="text-xs">Cidade</Label>
          <Input
            value={data.city}
            onChange={(e) => onChange({ city: e.target.value })}
            placeholder="Sua cidade"
            disabled={!!locks?.city}
          />
          {locks?.city && <p className="mt-1 text-[11px] text-emerald-600">Já preenchido</p>}
        </div>
        <div>
          <Label className="text-xs">UF</Label>
          <Input
            value={data.state}
            onChange={(e) => onChange({ state: e.target.value.toUpperCase().slice(0, 2) })}
            maxLength={2}
            placeholder="UF"
            disabled={!!locks?.state}
          />
          {locks?.state && <p className="mt-1 text-[11px] text-emerald-600">Já preenchido</p>}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onSkip} className="flex-1">Pular por enquanto</Button>
        <Button type="button" onClick={onNext} className="flex-1">Continuar</Button>
      </div>
    </div>
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
  /** Frente 4 — duplicidade inline (whatsapp). */
  duplicateWhatsapp?: boolean;
  checkingWhatsapp?: boolean;
  onWhatsappBlur?: () => void;
}

/** Máscara visual: 41 9 9745 2053 (DDD + 9 + 4 + 4). */
function formatWhatsappVisible(digits: string): string {
  const d = (digits || '').replace(/\D/g, '').slice(-11); // últimos 11 (sem 55)
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
    <div className="space-y-5">
      <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground">← Voltar</button>
      <header className="text-center space-y-1">
        <h1 className="font-display text-2xl font-bold text-foreground">Como te chamamos?</h1>
        <p className="text-sm text-muted-foreground">Só nome e WhatsApp — a parte chata acaba aqui.</p>
      </header>

      <div className="space-y-4">
        <div>
          <Label className="text-xs">Nome completo *</Label>
          <Input
            value={data.full_name}
            onChange={(e) => onChange({ full_name: e.target.value })}
            placeholder="Ex: Maria Silva"
            autoFocus
            disabled={!!locks?.full_name}
          />
          {locks?.full_name && <p className="mt-1 text-[11px] text-emerald-600">Já preenchido</p>}
          {!nameOk && data.full_name.length > 0 && (
            <p className="mt-1 text-xs text-destructive">Informe nome e sobrenome.</p>
          )}
        </div>

        <div>
          <Label className="text-xs flex items-center gap-1">
            <Phone className="h-3 w-3" /> WhatsApp *
          </Label>
          <div className="relative">
            <Input
              value={visibleWhats}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                onChange({ whatsapp: digits });
              }}
              onBlur={onWhatsappBlur}
              placeholder="41 9 9745 2053"
              inputMode="numeric"
              aria-invalid={duplicateWhatsapp || undefined}
              disabled={!!locks?.whatsapp}
              className={`pr-20 text-base font-medium tracking-wide ${duplicateWhatsapp ? 'border-destructive focus-visible:ring-destructive' : ''}`}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
              {checkingWhatsapp ? 'verificando...' : 'somente DDD + número'}
            </span>
          </div>
          {locks?.whatsapp && <p className="mt-1 text-[11px] text-emerald-600">Já preenchido</p>}
          {!whatsOk && data.whatsapp.length > 0 && (
            <p className="mt-1 text-xs text-destructive">Inclua DDD + número (mínimo 10 dígitos).</p>
          )}
          {duplicateWhatsapp && (
            <div
              role="alert"
              className="mt-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs"
            >
              <p className="font-semibold text-destructive">
                Este WhatsApp já está vinculado a outra conta.
              </p>
              <p className="mt-1 text-muted-foreground">
                Cada número só pode pertencer a um perfil para garantir que o cliente fale com a pessoa certa.
              </p>
              <ul className="mt-2 space-y-1 list-disc pl-4 text-muted-foreground">
                <li>Confira se digitou o DDD certo (ex.: <span className="font-mono">41</span> para Curitiba).</li>
                <li>Use um número exclusivo seu — número comercial é a melhor escolha.</li>
                <li>Se o número é seu mas você esqueceu a conta, faça login pelo e-mail original.</li>
              </ul>
              <button
                type="button"
                onClick={() => onChange({ whatsapp: '' })}
                className="mt-2 inline-flex items-center text-[11px] font-semibold text-destructive underline-offset-2 hover:underline"
              >
                Limpar e digitar outro número
              </button>
            </div>
          )}
        </div>
      </div>

      <Button
        type="button"
        size="lg"
        onClick={onSubmit}
        disabled={!canSubmit}
        className="w-full"
      >
        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Continuar
      </Button>
      <p className="text-center text-[10px] text-muted-foreground">
        Este passo não pode ser pulado — precisamos disso para te chamar de volta.
      </p>
    </div>
  );
};
