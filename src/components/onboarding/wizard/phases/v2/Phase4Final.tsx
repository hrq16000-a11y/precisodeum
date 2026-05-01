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
import {
  Loader2, ShieldCheck, Instagram, Facebook, ArrowRight, ArrowLeft, Check, Wifi,
  MapPin, FileText, Calendar, Camera as CameraIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import CpfCnpjInput from '@/components/onboarding/CpfCnpjInput';
import CompanyAddressForm from '@/components/company/CompanyAddressForm';
import { celebrate, CELEBRATION_IDS } from '@/lib/celebrate';
import { supabase } from '@/integrations/supabase/client';
import VerificationStatusBadge from '@/components/profile/VerificationStatusBadge';
import AvatarUpload from '@/components/AvatarUpload';
import type { OnboardingProfileData } from './types';
import { useFocusFieldFromReview } from './useFocusFieldFromReview';
import { wizardStyles as ws, wizardEnter } from './wizardStyles';

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
    <motion.div {...wizardEnter} className={ws.container}>
      <header className={ws.headerWrap}>
        <div className={ws.chip}>
          <CameraIcon className="h-3 w-3" /> Foto de perfil
        </div>
        <h1 className={ws.title}>Coloca uma foto sua.</h1>
        <p className={ws.subtitle}>
          Perfis com foto recebem até <span className="font-semibold text-foreground">3× mais chamados</span>.
        </p>
      </header>

      <div
        ref={focusAvatar.ref as any}
        className={`flex justify-center rounded-2xl border border-border bg-card p-4 shadow-card ${focusAvatar.highlightClass}`}
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

      <div className="flex flex-col gap-2 pt-1">
        <Button type="button" size="lg" onClick={onContinue} disabled={saving || !data.avatar_url} className={ws.cta}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar e continuar <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
        <Button type="button" variant="ghost" onClick={onSkip} disabled={saving} className={ws.ctaGhost}>
          Agora não
        </Button>
      </div>
    </motion.div>
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
  const [goOnline, setGoOnline] = useState(true); // pré-marcado: ficar ONLINE é opcional, mas default ON
  const focusDoc = useFocusFieldFromReview('document');
  const valid = isValidDoc(data.document, data.kind);
  const isPj = data.kind === 'pj';
  const docLabel = isPj ? 'CNPJ' : 'CPF';

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

  const handleSubmit = async () => {
    // Ficar ONLINE não depende mais do CPF/CNPJ — é uma opção independente.
    if (goOnline && userId) {
      try {
        await supabase.from('providers').update({ status: 'active' } as any).eq('user_id', userId);
      } catch { /* fail-soft */ }
    }
    if (valid) {
      setVerified(true);
      celebrate({ intensity: 'mini', id: `doc-verified:${userId || 'anon'}` });
      setTimeout(() => onContinue(), 1400);
    } else {
      // Sem documento: avança normalmente; o status ONLINE depende só do checkbox.
      onContinue();
    }
  };

  const handleBack = () => {
    window.dispatchEvent(new CustomEvent('wizard:request-back', { detail: { phase: 'phase4_document' } }));
  };

  return (
    <AnimatePresence mode="wait">
      {!verified ? (
        <motion.div key="doc" {...wizardEnter} className={ws.container}>
          <button
            type="button"
            onClick={handleBack}
            className={`${ws.backBtn} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
            aria-label="Voltar para a etapa anterior do cadastro"
            data-testid="phase4-doc-back"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Voltar
          </button>

          <header className={ws.headerWrap}>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-rose-500 text-white shadow-[0_0_24px_rgba(251,146,60,0.45)]">
              <ShieldCheck className="h-7 w-7" aria-hidden="true" />
            </div>
            <h1 className={ws.title}>Quer ficar ONLINE agora?</h1>
            <p className={ws.subtitle}>
              Receba chamados diretos no WhatsApp. {docLabel} é opcional e dá selo extra.
            </p>
          </header>

          {/* Checkbox principal: ficar ONLINE é independente do documento e já vem marcado.
              A11y: input com id estável + label associada via htmlFor + descrição via aria-describedby. */}
          <div className="rounded-2xl border border-emerald-300/60 bg-emerald-50/60 p-3 dark:border-emerald-500/30 dark:bg-emerald-950/20">
            <div className="flex items-start gap-3">
              <input
                id="phase4-go-online"
                type="checkbox"
                checked={goOnline}
                onChange={(e) => setGoOnline(e.target.checked)}
                aria-describedby="phase4-go-online-desc"
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              />
              <label htmlFor="phase4-go-online" className="cursor-pointer text-[13px] leading-snug text-foreground">
                <span className="font-semibold">Ficar ONLINE agora</span>
                <span id="phase4-go-online-desc" className="block text-[11px] text-muted-foreground">
                  Seu perfil aparecerá nas buscas. Pode desligar quando quiser.
                </span>
              </label>
            </div>
          </div>

          <div ref={focusDoc.ref as any} className={`${ws.card} ${focusDoc.highlightClass}`}>
            <label htmlFor="phase4-doc-input" className="block">
              <span className={ws.fieldLabel}>
                <FileText className="h-3.5 w-3.5" aria-hidden="true" /> {docLabel}{' '}
                <span className="ml-1 text-[10px] font-normal normal-case text-muted-foreground">
                  (opcional · ganha selo)
                </span>
              </span>
              <CpfCnpjInput
                id="phase4-doc-input"
                value={data.document}
                onChange={(digitsOnly) => { if (!locked) onChange({ document: digitsOnly }); }}
                mode={isPj ? 'cnpj' : 'cpf'}
                placeholder={isPj ? '00.000.000/0000-00' : '000.000.000-00'}
                disabled={!!locked}
                aria-describedby="phase4-doc-help"
              />
              {locked ? (
                <p id="phase4-doc-help" className="mt-1 text-[11px] text-emerald-600">
                  Já preenchido — não pode ser alterado aqui.
                </p>
              ) : (
                <p id="phase4-doc-help" className="mt-1 text-[10px] text-muted-foreground">
                  Nunca exibido publicamente.
                </p>
              )}
            </label>
            {/* Badge de verificação só aparece quando há algo a comunicar (pending/review/verified).
                No estado 'none' (não enviado) seria duplicidade do que o passo já diz. */}
            {userId && (
              <div className="mt-2">
                <VerificationStatusBadge
                  userId={userId}
                  showHistory={false}
                  docKind={isPj ? 'pj' : 'pf'}
                  hideWhenNone
                />
              </div>
            )}
          </div>

          {isPj && (
            <CompanyAddressForm
              collapsible
              revealLabel="Possui ponto de atendimento físico (loja, oficina, salão)?"
              cityPreview={{ city: data.city, neighborhood: data.neighborhood }}
              value={{
                street: data.street,
                street_number: data.street_number,
                complement: data.complement,
                postal_code: data.postal_code,
                show_full_address: data.show_full_address,
                street_suggested: data.street_suggested,
                street_suggested_cep: data.street_suggested_cep,
                street_confirmed: data.street_confirmed,
                cep_history: data.cep_history,
              }}
              onChange={(patch) => onChange(patch as Partial<OnboardingProfileData>)}
            />
          )}

          <div className="flex flex-col gap-2 pt-1">
            <Button type="button" size="lg" onClick={handleSubmit} disabled={saving} className={ws.cta}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {goOnline ? 'Ficar ONLINE' : 'Continuar'} <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button type="button" variant="ghost" onClick={onSkip} disabled={saving} className={ws.ctaGhost}>
              Pular por enquanto
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
    <motion.div {...wizardEnter} className={ws.container}>
      <header className={ws.headerWrap}>
        <h1 className={ws.title}>Quase lá — falta só ajustar seu perfil.</h1>
        <p className={ws.subtitle}>Ajuda quem busca por você na sua região.</p>
      </header>

      <div className={ws.card}>
        <label className="block">
          <span className={ws.fieldLabel}>
            <Calendar className="h-3.5 w-3.5" /> Tempo de experiência
          </span>
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
            placeholder="Ex: 5"
          />
        </label>

        {/* Bairro foi movido para a tela de localização (Fase 1). */}

        <label className="block">
          <span className={ws.fieldLabel}>
            <FileText className="h-3.5 w-3.5" /> Bio curta <span className="text-muted-foreground">(opcional)</span>
          </span>
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
        </label>
      </div>

      <div className="flex flex-col gap-2 pt-1">
        <Button type="button" size="lg" onClick={onContinue} disabled={saving} className={ws.cta}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar e continuar <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
        <Button type="button" variant="ghost" onClick={onSkip} disabled={saving} className={ws.ctaGhost}>
          Pular
        </Button>
      </div>
    </motion.div>
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

  // Resumo PJ — só aparece quando o usuário preencheu algum dado de endereço.
  const isPj = data.kind === 'pj';
  const hasAddress = !!(data.street || data.street_number || data.postal_code || data.complement);
  const showPjReview = isPj && hasAddress;
  const formattedAddress = [
    [data.street, data.street_number].filter(Boolean).join(', '),
    data.complement,
    data.neighborhood,
    [data.city, data.state].filter(Boolean).join(' / '),
    data.postal_code ? `CEP ${data.postal_code.replace(/(\d{5})(\d{3})/, '$1-$2')}` : '',
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <motion.div {...wizardEnter} className={ws.container}>
      <header className={ws.headerWrap}>
        <h1 className={ws.title}>Suas redes (opcional)</h1>
        <p className={ws.subtitle}>Mostre seu trabalho onde já existe.</p>
      </header>

      <div className={ws.card}>
        <label className="block">
          <span className={ws.fieldLabel}>
            <Instagram className="h-3.5 w-3.5" /> Instagram
          </span>
          <Input
            ref={focusInsta.ref}
            className={focusInsta.highlightClass}
            value={data.instagram_url}
            onChange={(e) => onChange({ instagram_url: e.target.value })}
            placeholder="@seuusuario ou link"
          />
        </label>
        <label className="block">
          <span className={ws.fieldLabel}>
            <Facebook className="h-3.5 w-3.5" /> Facebook
          </span>
          <Input
            ref={focusFb.ref}
            className={focusFb.highlightClass}
            value={data.facebook_url}
            onChange={(e) => onChange({ facebook_url: e.target.value })}
            placeholder="Link da sua página"
          />
        </label>
      </div>

      {showPjReview && (
        <div
          data-testid="pj-address-review"
          className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3 text-[12px] leading-snug"
        >
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-700">
            <MapPin className="h-3 w-3" /> Confirme seu endereço PJ
          </div>
          <p className="text-foreground">{formattedAddress || 'Endereço incompleto.'}</p>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {data.show_full_address
              ? 'Será exibido publicamente no seu perfil.'
              : 'Ficará oculto — só aparece a cidade/bairro.'}
          </p>
          <label className="mt-2 flex cursor-pointer items-start gap-2 text-[11px] text-foreground">
            <input
              type="checkbox"
              checked={Boolean(data.show_full_address)}
              onChange={(e) => onChange({ show_full_address: e.target.checked } as Partial<OnboardingProfileData>)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            />
            <span>Exibir endereço completo no perfil público.</span>
          </label>
        </div>
      )}

      <div className="flex flex-col gap-2 pt-1">
        <Button type="button" size="lg" onClick={onFinish} disabled={saving} className={ws.cta}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar e revisar <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
        <Button type="button" variant="ghost" onClick={onSkip} disabled={saving} className={ws.ctaGhost}>
          Pular redes e revisar
        </Button>
      </div>
    </motion.div>
  );
};
