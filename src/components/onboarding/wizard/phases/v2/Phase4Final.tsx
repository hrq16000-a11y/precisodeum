/**
 * Phase4 — Coleta Subliminar (Pós-Sucesso).
 *
 * Sub-passos:
 *  8. Upsell de documento (CPF/CNPJ) → "ficar ONLINE agora"
 *  9. Bairro + Bio (opcional)
 *  10. Redes sociais (opcional)
 *
 * Regra de Ouro da Memória: campos já preenchidos em fases anteriores
 * NÃO são reapresentados — Phase 4 só pede o que ainda está vazio.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ShieldCheck, Instagram, Facebook, ArrowRight, Check, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import CpfCnpjInput from '@/components/onboarding/CpfCnpjInput';
import { celebrate, CELEBRATION_IDS } from '@/lib/celebrate';
import { supabase } from '@/integrations/supabase/client';
import VerificationStatusBadge from '@/components/profile/VerificationStatusBadge';
import AvatarUpload from '@/components/AvatarUpload';
import type { OnboardingProfileData } from './types';
import { useFocusFieldFromReview } from './useFocusFieldFromReview';

/* ───── 4.0 Foto de perfil (se ainda faltar) ───── */

interface AvatarProps {
  data: OnboardingProfileData;
  onChange: (patch: Partial<OnboardingProfileData>) => void;
  onContinue: () => void;
  onSkip: () => void;
  saving: boolean;
  userId?: string;
}

export const Phase4Avatar = ({ data, onChange, onContinue, onSkip, saving, userId }: AvatarProps) => {
  const focusAvatar = useFocusFieldFromReview('avatar_url');
  const initials = (data.full_name || 'EU')
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="space-y-5">
      <header className="text-center space-y-1">
        <h1 className="font-display text-2xl font-bold text-foreground">Coloca uma foto sua.</h1>
        <p className="text-sm text-muted-foreground">
          Perfis com foto recebem até <span className="font-semibold text-foreground">3x mais chamados</span>.
        </p>
      </header>

      <div
        ref={focusAvatar.ref as any}
        className={`flex justify-center py-2 rounded-2xl ${focusAvatar.highlightClass}`}
      >
        {userId && (
          <AvatarUpload
            userId={userId}
            currentUrl={data.avatar_url}
            initials={initials}
            onUploaded={(url) => onChange({ avatar_url: url })}
          />
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onSkip} disabled={saving} className="flex-1">
          Agora não
        </Button>
        <Button
          type="button"
          onClick={onContinue}
          disabled={saving || !data.avatar_url}
          className="flex-1"
        >
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar e continuar <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
};

/* ───── 4.1 Upsell de documento (CPF/CNPJ) ───── */

interface DocumentProps {
  data: OnboardingProfileData;
  onChange: (patch: Partial<OnboardingProfileData>) => void;
  onContinue: () => void;
  onSkip: () => void;
  saving: boolean;
  userId?: string;
  /** Lock vindo do V3: se já preenchido, não pode reabrir/alterar aqui. */
  locked?: boolean;
}

function isValidDoc(digits: string, kind: 'pf' | 'pj'): boolean {
  const d = (digits || '').replace(/\D/g, '');
  return kind === 'pj' ? d.length === 14 : d.length === 11;
}

export const Phase4Document = ({ data, onChange, onContinue, onSkip, saving, userId, locked }: DocumentProps) => {
  const [verified, setVerified] = useState(false);
  const [providerStatus, setProviderStatus] = useState<string | null>(null);
  const focusDoc = useFocusFieldFromReview('document');
  const valid = isValidDoc(data.document, data.kind);

  // Auto-avança quando o documento já foi capturado no V3 (não re-perguntar).
  useEffect(() => {
    if (locked && valid) {
      const t = setTimeout(() => onContinue(), 250);
      return () => clearTimeout(t);
    }
  }, [locked, valid, onContinue]);

  // Realtime: ouve mudanças no provider para refletir status "online" assim que o backend confirma.
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      const { data: prov } = await supabase
        .from('providers')
        .select('id, status')
        .eq('user_id', userId)
        .maybeSingle();
      if (alive && prov) setProviderStatus(prov.status as string);
      if (!prov?.id) return;
      const channel = supabase
        .channel(`provider-status:${prov.id}`)
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'providers', filter: `id=eq.${prov.id}` },
          (payload: any) => {
            if (!alive) return;
            const next = payload.new?.status;
            if (next) setProviderStatus(next);
          })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    })();
    return () => { alive = false; };
  }, [userId]);

  const handleVerify = async () => {
    if (!valid) return;
    setVerified(true);
    celebrate({ intensity: 'mini', id: `doc-verified:${userId || 'anon'}` });
    // Marca o provider como ativo (online) — o canal realtime acima reflete instantaneamente
    if (userId) {
      try {
        await supabase.from('providers').update({ status: 'active' } as any).eq('user_id', userId);
      } catch { /* fail-soft */ }
    }
    setTimeout(() => onContinue(), 1600);
  };

  return (
    <AnimatePresence mode="wait">
      {!verified ? (
        <motion.div
          key="doc"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="space-y-5"
        >
          <header className="text-center space-y-1">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-7 w-7 text-primary" />
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">Quer ficar ONLINE agora?</h1>
            <p className="text-sm text-muted-foreground">
              Adicione seu {data.kind === 'pj' ? 'CNPJ' : 'CPF'} para receber chamados diretos no WhatsApp.
            </p>
          </header>

          {userId && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Status atual da sua verificação
              </p>
              <VerificationStatusBadge userId={userId} showHistory />
            </div>
          )}

          <div ref={focusDoc.ref as any} className={`rounded-md ${focusDoc.highlightClass}`}>
            <Label className="text-xs">{data.kind === 'pj' ? 'CNPJ' : 'CPF'}</Label>
            <CpfCnpjInput
              value={data.document}
              onChange={(digitsOnly) => { if (!locked) onChange({ document: digitsOnly }); }}
              mode={data.kind === 'pj' ? 'cnpj' : 'cpf'}
              placeholder={data.kind === 'pj' ? '00.000.000/0000-00' : '000.000.000-00'}
              disabled={!!locked}
            />
            {locked ? (
              <p className="mt-1 text-[11px] text-emerald-600">Já preenchido — não pode ser alterado aqui.</p>
            ) : (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Usado apenas para validar seu perfil. Nunca exibido publicamente.
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onSkip} disabled={saving} className="flex-1">
              Agora não
            </Button>
            <Button type="button" onClick={handleVerify} disabled={!valid || saving} className="flex-1">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ficar ONLINE
            </Button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="ok"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 240, damping: 18 }}
          className="space-y-4 text-center py-6"
        >
          <motion.div
            initial={{ rotate: -180, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.1 }}
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-2xl"
          >
            <Check className="h-10 w-10 stroke-[3]" />
          </motion.div>
          <h2 className="font-display text-2xl font-bold text-foreground">Veja que legal!</h2>
          <p className="text-sm text-muted-foreground">
            Seu perfil está verificado e{' '}
            <span className={`font-bold ${providerStatus === 'active' ? 'text-emerald-600' : 'text-amber-600'}`}>
              {providerStatus === 'active' ? 'ONLINE' : 'sincronizando…'}
            </span>
            .
          </p>
          <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1 text-[11px] text-emerald-700">
            <Wifi className={`h-3 w-3 ${providerStatus === 'active' ? 'animate-pulse' : ''}`} />
            <span>Status atualizado em tempo real</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ───── 4.2 Bairro + Bio ───── */

interface ExtrasAProps {
  data: OnboardingProfileData;
  onChange: (patch: Partial<OnboardingProfileData>) => void;
  onContinue: () => void;
  onSkip: () => void;
  saving: boolean;
}

export const Phase4ExtrasA = ({ data, onChange, onContinue, onSkip, saving }: ExtrasAProps) => {
  const focusBio = useFocusFieldFromReview('bio');
  const focusNeighborhood = useFocusFieldFromReview('neighborhood');
  return (
  <div className="space-y-5">
    <header className="text-center space-y-1">
      <h1 className="font-display text-2xl font-bold text-foreground">Quase lá — falta só ajustar seu perfil.</h1>
      <p className="text-sm text-muted-foreground">Ajuda quem busca por você na sua região.</p>
    </header>

    <div className="space-y-4">
      <div>
        <Label className="text-xs">Tempo de experiência</Label>
        <Input
          type="number"
          min={0}
          max={60}
          inputMode="numeric"
          value={data.years_experience ?? ''}
          onChange={(e) => {
            const value = e.target.value;
            onChange({ years_experience: value === '' ? null : Math.max(0, Number(value)) });
          }}
          placeholder="Ex: 5 anos"
        />
      </div>

      <div>
        <Label className="text-xs">Bairro <span className="text-muted-foreground">(opcional)</span></Label>
        <Input
          ref={focusNeighborhood.ref}
          className={focusNeighborhood.highlightClass}
          value={data.neighborhood}
          onChange={(e) => onChange({ neighborhood: e.target.value })}
          placeholder="Ex: Centro"
        />
      </div>

      <div>
        <Label className="text-xs">Bio curta <span className="text-muted-foreground">(opcional)</span></Label>
        <Textarea
          ref={focusBio.ref}
          className={focusBio.highlightClass}
          value={data.bio}
          onChange={(e) => onChange({ bio: e.target.value.slice(0, 280) })}
          placeholder="Em uma frase, o que te diferencia."
          rows={3}
          maxLength={280}
        />
        <p className="mt-1 text-right text-[10px] text-muted-foreground">{data.bio.length}/280</p>
      </div>
    </div>

    <div className="flex gap-2 pt-2">
      <Button type="button" variant="ghost" onClick={onSkip} disabled={saving} className="flex-1">Pular</Button>
      <Button type="button" onClick={onContinue} disabled={saving} className="flex-1">
        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Salvar e continuar <ArrowRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  </div>
  );
};

/* ───── 4.3 Redes sociais ───── */

interface ExtrasBProps {
  data: OnboardingProfileData;
  onChange: (patch: Partial<OnboardingProfileData>) => void;
  onFinish: () => void;
  onSkip: () => void;
  saving: boolean;
}

export const Phase4ExtrasB = ({ data, onChange, onFinish, onSkip, saving }: ExtrasBProps) => {
  const focusInsta = useFocusFieldFromReview('instagram_url');
  const focusFb = useFocusFieldFromReview('facebook_url');
  return (
  <div className="space-y-5">
    <header className="text-center space-y-1">
      <h1 className="font-display text-2xl font-bold text-foreground">Suas redes (opcional)</h1>
      <p className="text-sm text-muted-foreground">Mostre seu trabalho onde já existe.</p>
    </header>

    <div className="space-y-4">
      <div>
        <Label className="text-xs flex items-center gap-1"><Instagram className="h-3 w-3 text-primary" /> Instagram</Label>
        <Input
          ref={focusInsta.ref}
          className={focusInsta.highlightClass}
          value={data.instagram_url}
          onChange={(e) => onChange({ instagram_url: e.target.value })}
          placeholder="@seuusuario ou link"
        />
      </div>
      <div>
        <Label className="text-xs flex items-center gap-1"><Facebook className="h-3 w-3 text-primary" /> Facebook</Label>
        <Input
          ref={focusFb.ref}
          className={focusFb.highlightClass}
          value={data.facebook_url}
          onChange={(e) => onChange({ facebook_url: e.target.value })}
          placeholder="Link da sua página"
        />
      </div>
    </div>

    <div className="flex gap-2 pt-2">
      <Button type="button" variant="ghost" onClick={onSkip} disabled={saving} className="flex-1">Finalizar sem redes</Button>
      <Button type="button" onClick={onFinish} disabled={saving} className="flex-1">
        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Finalizar
      </Button>
    </div>
  </div>
  );
};
