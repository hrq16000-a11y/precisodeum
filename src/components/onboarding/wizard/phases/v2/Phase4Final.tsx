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

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, ShieldCheck, Instagram, Facebook, ArrowRight, Check, Wifi,
  FileText, Calendar, Camera as CameraIcon, Globe, MapPin, Eye, EyeOff,
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
import { useAuth } from '@/hooks/useAuth';
import { getSocialAvatarUrl } from '@/lib/avatarUtils';
import { generateUniqueAvatar, generateAvatarVariants } from '@/lib/avatarGenerator';
import { toast } from 'sonner';
import AvatarCropDialog from './AvatarCropDialog';
import type { OnboardingProfileData } from './types';
import { useFocusFieldFromReview } from './useFocusFieldFromReview';
import { wizardStyles as ws, wizardEnter } from './wizardStyles';
import { scheduleWizardTimeout } from '@/lib/wizardZombieGuard';

/* ───── 4.0 Foto de perfil (se ainda faltar) ───── */

interface AvatarProps {
  data: OnboardingProfileData;
  onChange: (patch: Partial<OnboardingProfileData>) => void;
  onContinue: () => void;
  onSkip: () => void;
  onBack?: () => void;
  saving: boolean;
  userId?: string;
}

export const Phase4Avatar = ({ data, onChange, onContinue, onSkip, onBack, saving, userId }: AvatarProps) => {
  const focusAvatar = useFocusFieldFromReview('avatar_url');
  const { user } = useAuth();
  const socialUrl = getSocialAvatarUrl(user);

  // Categoria selecionada → personaliza o avatar gerado.
  const [categoryInfo, setCategoryInfo] = useState<{ name: string; icon: string | null } | null>(null);
  useEffect(() => {
    let alive = true;
    if (!data.primary_category_id) { setCategoryInfo(null); return; }
    (async () => {
      const { data: cat } = await supabase
        .from('categories')
        .select('name, icon')
        .eq('id', data.primary_category_id!)
        .maybeSingle();
      if (alive && cat) setCategoryInfo({ name: cat.name as string, icon: (cat.icon as string) || null });
    })();
    return () => { alive = false; };
  }, [data.primary_category_id]);

  const initials = (data.full_name || 'EU')
    .split(' ').map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  // Seed persistido em data.avatar_seed (sobrevive a Voltar).
  const seed = data.avatar_seed ?? 0;
  const generatedUrl = generateUniqueAvatar({
    userId,
    fullName: data.full_name,
    categoryName: categoryInfo?.name,
    categoryIcon: categoryInfo?.icon,
    seed,
  });
  // Toggle 6 / 12 variantes — escolha do usuário, sem perder a seleção atual.
  const [variantCount, setVariantCount] = useState<6 | 12>(6);
  const variants = generateAvatarVariants(
    {
      userId,
      fullName: data.full_name,
      categoryName: categoryInfo?.name,
      categoryIcon: categoryInfo?.icon,
    },
    variantCount,
  );

  // Auto-sugestão: se o usuário ainda não escolheu nada e a categoria carregou,
  // já mostramos o avatar gerado como pré-seleção (mas não bloqueia upload/câmera).
  // Aplica detecção de colisão: se algum dos avatares "já usados" do próprio usuário
  // bater com o seed 0, avançamos pro próximo seed disponível dentro das variantes.
  useEffect(() => {
    if (!data.avatar_url && !data.avatar_source && categoryInfo) {
      const used = new Set<string>([data.avatar_url || ''].filter(Boolean));
      const fresh = variants.find((v) => !used.has(v.url)) || variants[0];
      onChange({ avatar_url: fresh.url, avatar_seed: fresh.seed, avatar_source: 'generated' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryInfo?.name]);

  // Câmera dedicada: input file com `capture="environment"` força a câmera no mobile.
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  // Crop dialog state
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropSource, setCropSource] = useState<'camera' | 'upload'>('upload');

  /**
   * Etapa 1: validação rigorosa do arquivo recebido (tipo/tamanho/dimensões).
   * Em caso de falha, BLOQUEIA — não há fallback silencioso pra avatar gerado.
   * O usuário precisa escolher outro arquivo OU clicar em uma variação minimalista.
   */
  const handleSelectFile = async (file: File | null, source: 'camera' | 'upload') => {
    if (!file) return;
    const { validateImageFile } = await import('@/lib/imageValidation');
    const v = await validateImageFile(file, {
      maxSizeBytes: 5 * 1024 * 1024, // 5MB
      minSizeBytes: 5 * 1024,        // 5KB anti-arquivo-vazio
      minDimension: 200,             // avatar precisa renderizar bem em 80×80
      maxDimension: 6000,
      allowedMimes: [
        'image/jpeg', 'image/jpg', 'image/png',
        'image/webp', 'image/avif', 'image/heic', 'image/heif',
      ],
    });
    if (!v.ok) {
      // Mensagens claras + ação corretiva. SEM fallback automático.
      const hint =
        v.code === 'invalid_type'  ? 'Use JPG, PNG, WebP ou HEIC.'
      : v.code === 'too_large'     ? 'Tente uma imagem menor que 5MB.'
      : v.code === 'too_small'     ? 'A imagem parece corrompida. Escolha outra.'
      : v.code === 'dim_too_large' ? 'Reduza as dimensões antes de enviar.'
      : v.code === 'dim_too_small' ? 'Use uma imagem com pelo menos 200×200px.'
      : v.code === 'corrupt'       ? 'Não consegui abrir essa imagem. Escolha outra.'
      :                              'Tente outra imagem.';
      toast.error(v.message ?? 'Arquivo inválido', { description: hint });
      return; // ← bloqueia, mantém estado anterior intacto.
    }
    // Validou → abre o crop dialog.
    setCropSource(source);
    setCropFile(file);
  };

  /**
   * Etapa 2: o usuário confirmou o recorte. Comprimimos o blob (já 512×512 jpeg)
   * e subimos no Storage via edge `optimize-image`. Em caso de falha, mostramos
   * erro claro e mantemos o avatar atual — sem trocar pelo gerado às escondidas.
   */
  const handleCroppedConfirm = async (cropped: File) => {
    if (!userId) {
      toast.error('Faça login pra enviar a foto.');
      setCropFile(null);
      return;
    }
    const source = cropSource;
    setCropFile(null); // fecha modal antes do upload
    try {
      const { compressImage } = await import('@/lib/compressImage');
      const compressed = await compressImage(cropped, { maxDimension: 512, targetKB: 200 });
      const finalFile = compressed || cropped;
      const { uploadWithFallback } = await import('@/lib/uploadWithFallback');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Sessão expirada. Faça login de novo.');
        return;
      }
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const result = await uploadWithFallback<{ url: string; error?: string }>(finalFile, {
        url: `https://${projectId}.supabase.co/functions/v1/optimize-image`,
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session.access_token}`,
        },
        baseMaxDimension: 512,
        baseTargetKB: 200,
        buildFormData: (f) => {
          const fd = new FormData();
          fd.append('file', f);
          fd.append('bucket', 'avatars');
          fd.append('folder', userId);
          return fd;
        },
      });
      if (result.data.error) throw new Error(result.data.error);
      const publicUrl = result.data.url;
      // Fase 1.6.4 — Canonical avatar write boundary.
      const { setUserAvatar } = await import('@/lib/avatarSync');
      await setUserAvatar({ userId, url: publicUrl, source: 'onboarding_phase4_avatar' });
      onChange({ avatar_url: publicUrl, avatar_source: source });
      toast.success(source === 'camera' ? 'Foto capturada e otimizada!' : 'Foto enviada!');
    } catch (err: any) {
      // Erro real de rede/upload → mostramos mensagem honesta, sem trocar avatar.
      toast.error('Não consegui enviar a foto agora.', {
        description: 'Verifique sua conexão e tente de novo, ou escolha um avatar minimalista.',
      });
    }
  };

  /**
   * Detecção de colisão: ao selecionar uma variação gerada, se a URL já estiver
   * em uso pelo próprio usuário (mesmo seed), saltamos pro próximo seed disponível.
   */
  const handlePickVariant = (seed: number, url: string) => {
    if (data.avatar_url === url && data.avatar_source === 'generated') {
      // mesmo avatar já selecionado — força próxima variação livre.
      const next = variants.find((v) => v.url !== url) || variants[0];
      onChange({ avatar_seed: next.seed, avatar_url: next.url, avatar_source: 'generated' });
      return;
    }
    onChange({ avatar_seed: seed, avatar_url: url, avatar_source: 'generated' });
  };

  const sourceLabel: Record<string, string> = {
    camera: 'Foto capturada',
    upload: 'Foto da galeria',
    social: 'Foto da conta',
    generated: 'Avatar gerado',
  };

  return (
    <motion.div {...wizardEnter} className={ws.container}>
      <button
        type="button"
        onClick={() => (onBack ? onBack() : window.dispatchEvent(new CustomEvent('wizard:request-back', { detail: { phase: 'phase4_avatar' } })))}
        className={ws.backBtn}
        aria-label="Voltar para a etapa anterior do cadastro"
      >
        Voltar
      </button>
      <header className={ws.headerWrap}>
        <div className={ws.chip}>
          <CameraIcon className="h-3 w-3" /> Foto de perfil
        </div>
        <h1 className={ws.title}>Coloca uma foto sua.</h1>
        <p className={ws.subtitle}>
          Perfis com foto recebem até <span className="font-semibold text-foreground">3× mais chamados</span>.
        </p>
      </header>

      {/* Preview central — sempre algum avatar visível (gerado quando vazio). */}
      <div
        ref={focusAvatar.ref as any}
        className={`flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 shadow-card ${focusAvatar.highlightClass}`}
      >
        <img
          src={data.avatar_url || generatedUrl}
          alt={initials}
          className="h-24 w-24 rounded-full border-4 border-background object-cover shadow-lg"
        />
        {data.avatar_source && (
          <span className="text-[11px] text-muted-foreground">
            {sourceLabel[data.avatar_source] || 'Foto atual'}
          </span>
        )}
      </div>

      {/* Inputs ocultos pra Câmera (capture) e Galeria (sem capture). */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0] || null; e.currentTarget.value = ''; handleSelectFile(f, 'camera'); }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0] || null; e.currentTarget.value = ''; handleSelectFile(f, 'upload'); }}
      />

      {/* 4 ações em grid 2×2. Mobile: câmera, galeria, conta social (se houver), avatar gerado. */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="rounded-xl border border-border bg-card p-3 text-[12px] font-medium text-foreground hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          data-testid="phase4-avatar-camera"
        >
          <span className="flex items-center justify-center gap-2">
            <CameraIcon className="h-4 w-4" aria-hidden="true" /> Tirar foto
          </span>
        </button>
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          className="rounded-xl border border-border bg-card p-3 text-[12px] font-medium text-foreground hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          data-testid="phase4-avatar-gallery"
        >
          <span className="flex items-center justify-center gap-2">
            Escolher da galeria
          </span>
        </button>
        {socialUrl && (
          <button
            type="button"
            onClick={() => onChange({ avatar_url: socialUrl, avatar_source: 'social' })}
            className="rounded-xl border border-border bg-card p-3 text-[12px] font-medium text-foreground hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            data-testid="phase4-avatar-use-google"
          >
            <span className="flex items-center justify-center gap-2">
              <img src={socialUrl} alt="" aria-hidden="true" loading="lazy" decoding="async" className="h-5 w-5 rounded-full object-cover" />
              Usar foto da conta
            </span>
          </button>
        )}
      </div>

      {/* Grade de avatares minimalistas — usuário escolhe qual gosta mais. */}
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[12px] font-semibold text-foreground">
            Ou escolha um avatar minimalista
          </span>
          <div className="flex items-center gap-1" role="group" aria-label="Quantidade de variações">
            {([6, 12] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setVariantCount(n)}
                aria-pressed={variantCount === n}
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                  variantCount === n
                    ? 'bg-amber-500 text-white'
                    : 'bg-muted/40 text-muted-foreground hover:bg-muted/70'
                }`}
                data-testid={`phase4-variant-count-${n}`}
              >
                {n} opções
              </button>
            ))}
          </div>
        </div>
        {categoryInfo && (
          <div className="mb-2 text-[10px] text-muted-foreground">{categoryInfo.name}</div>
        )}
        <div
          role="radiogroup"
          aria-label="Avatares minimalistas sugeridos"
          className="grid grid-cols-6 gap-2"
        >
          {variants.map((v) => {
            const isSelected = data.avatar_source === 'generated' && (data.avatar_seed ?? 0) === v.seed;
            return (
              <button
                key={v.seed}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`Avatar variação ${v.seed + 1}`}
                onClick={() => handlePickVariant(v.seed, v.url)}
                className={`relative aspect-square overflow-hidden rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                  isSelected
                    ? 'border-amber-400 ring-2 ring-amber-400/40 scale-105'
                    : 'border-border hover:border-amber-300'
                }`}
                data-testid={`phase4-avatar-variant-${v.seed}`}
              >
                <img src={v.url} alt="" aria-hidden="true" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        {categoryInfo
          ? `Avatar minimalista personalizado pra ${categoryInfo.name}.`
          : 'Tire uma foto, escolha da galeria, use a foto da conta ou um avatar gerado.'}
      </p>

      <div className="flex flex-col gap-2 pt-1">
        <Button
          type="button"
          size="lg"
          onClick={onContinue}
          disabled={saving || !data.avatar_url}
          className={ws.cta}
        >
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar e continuar <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
        <Button type="button" variant="ghost" onClick={onSkip} disabled={saving} className={ws.ctaGhost}>
          Agora não
        </Button>
      </div>

      {/* Mantém o AvatarUpload original disponível (escondido) caso outras telas o reusem.
          Mas o fluxo principal acima cobre todas as opções pedidas. */}
      <div className="hidden">
        {userId && (
          <AvatarUpload
            userId={userId}
            currentUrl={data.avatar_url}
            initials={initials}
            onUploaded={(url) => onChange({ avatar_url: url, avatar_source: 'upload' })}
          />
        )}
      </div>

      {/* Crop dialog — abre depois da validação rigorosa do arquivo. */}
      <AvatarCropDialog
        open={!!cropFile}
        file={cropFile}
        onCancel={() => setCropFile(null)}
        onConfirm={handleCroppedConfirm}
      />
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
  // Persistido em data.go_online (default true) → sobrevive a Voltar/restauração de draft.
  const goOnline = data.go_online !== false;
  const setGoOnline = (next: boolean) => onChange({ go_online: next });
  const focusDoc = useFocusFieldFromReview('document');
  const valid = isValidDoc(data.document, data.kind);
  const isPj = data.kind === 'pj';
  const docLabel = isPj ? 'CNPJ' : 'CPF';

  // Auto-avança quando o documento já foi capturado no V3 (não re-perguntar).
  useEffect(() => {
    if (locked && valid) {
      const t = scheduleWizardTimeout(
        { phase: 'phase4_document', action: 'phase4_doc_autoadvance' },
        () => onContinue(),
        250,
      );
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

  // Timer da animação pós-verify — rastreado para cleanup no unmount.
  const verifyDelayTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (verifyDelayTimer.current) window.clearTimeout(verifyDelayTimer.current);
  }, []);

  const handleSubmit = async () => {
    // Ficar ONLINE não depende mais do CPF/CNPJ — é uma opção independente.
    // FASE 1.6.1 — NÃO É BYPASS DO FINALIZE: este UPDATE reflete a escolha
    // explícita do usuário no checkbox "Ficar ONLINE agora". O entrypoint
    // canônico `finalize_onboarding_atomic` só governa
    // profiles.onboarding_completed/onboarding_step/profile_type; o flag
    // providers.status='active' é UX-driven aqui e permanece intencional.
    // TODO (médio prazo 1.6.7): mover para RPC `set_provider_online_atomic`.
    if (goOnline && userId) {
      // FASE 1.6.3 — tracker observável (sem alterar UX: fail-soft preservado).
      try {
        const { createSyncTracker, logSyncFailure } = await import('@/lib/multiWriteSync');
        const sync = createSyncTracker();
        const { error } = await supabase.from('providers').update({ status: 'active' } as any).eq('user_id', userId);
        if (error) {
          sync.mark('status', false);
          await logSyncFailure({
            action: 'phase4_sync_failed',
            source: 'phase4_go_online',
            snapshot: sync.snapshot(),
            errorCode: (error as any).code || 'provider_status_update_failed',
          });
        } else {
          sync.mark('status', true);
        }
      } catch { /* fail-soft — não bloqueia o "Ficar online" */ }
    }
    if (valid) {
      setVerified(true);
      celebrate({ intensity: 'mini', id: `doc-verified:${userId || 'anon'}` });
      if (verifyDelayTimer.current) window.clearTimeout(verifyDelayTimer.current);
      verifyDelayTimer.current = scheduleWizardTimeout(
        { phase: 'phase4_document', action: 'doc_verified_continue' },
        () => onContinue(),
        1400,
      );
    } else {
      // Sem documento: avança normalmente; o status ONLINE depende só do checkbox.
      onContinue();
    }
  };

  return (
    <AnimatePresence mode="wait">
      {!verified ? (
        <motion.div key="doc" {...wizardEnter} className={ws.container}>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('wizard:request-back', { detail: { phase: 'phase4_document' } }))}
            className={ws.backBtn}
            aria-label="Voltar para a etapa anterior do cadastro"
          >
            Voltar
          </button>
          <header className={ws.headerWrap}>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-emerald-500 text-white shadow-[0_0_24px_rgba(251,146,60,0.45)]">
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

          {(() => {
            const docDigits = (data.document || '').replace(/\D/g, '');
            // Documento é opcional: bloqueia somente quando preenchido mas inválido.
            const docFilledButInvalid = docDigits.length > 0 && !valid;
            const blocked = saving || docFilledButInvalid;
            return (
              <div className="flex flex-col gap-2 pt-1">
                <Button
                  type="button"
                  size="lg"
                  onClick={handleSubmit}
                  disabled={blocked}
                  aria-disabled={blocked}
                  title={docFilledButInvalid ? `Verifique o ${docLabel} digitado antes de continuar` : undefined}
                  className={ws.cta}
                >
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {goOnline ? 'Ficar ONLINE' : 'Continuar'} <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                {docFilledButInvalid && (
                  <p className="text-[11px] text-amber-600 text-center">
                    {docLabel} inválido — corrija ou apague para continuar (o campo é opcional).
                  </p>
                )}
                <Button type="button" variant="ghost" onClick={onSkip} disabled={saving} className={ws.ctaGhost}>
                  Pular por enquanto
                </Button>
              </div>
            );
          })()}
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
          <h2 className="font-display text-2xl font-bold text-foreground break-words">Veja que legal!</h2>
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
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent('wizard:request-back', { detail: { phase: 'phase4_extras_a' } }))}
        className={ws.backBtn}
        aria-label="Voltar para a etapa anterior do cadastro"
      >
        Voltar
      </button>
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
  onBack?: () => void;
  saving: boolean;
}

export const Phase4ExtrasB = ({ data, onChange, onFinish, onSkip, onBack, saving }: ExtrasBProps) => {
  const focusInsta = useFocusFieldFromReview('instagram_url');
  const focusFb = useFocusFieldFromReview('facebook_url');
  const focusSite = useFocusFieldFromReview('website_url' as any);

  return (
    <motion.div {...wizardEnter} className={ws.container}>
      <button
        type="button"
        data-testid="phase4-extras-b-back"
        onClick={() => (onBack ? onBack() : window.dispatchEvent(new CustomEvent('wizard:request-back', { detail: { phase: 'phase4_extras_b' } })))}
        className={ws.backBtn}
        aria-label="Voltar para a etapa anterior do cadastro"
      >
        Voltar
      </button>
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
        <label className="block">
          <span className={ws.fieldLabel}>
            <Globe className="h-3.5 w-3.5" /> Site / portfólio
          </span>
          <Input
            ref={focusSite.ref}
            className={focusSite.highlightClass}
            type="url"
            inputMode="url"
            autoComplete="url"
            value={data.website_url ?? ''}
            onChange={(e) => onChange({ website_url: e.target.value } as Partial<OnboardingProfileData>)}
            placeholder="https://seusite.com.br"
            data-testid="phase4-website-url"
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Aparece publicamente no seu perfil.
          </span>
        </label>
      </div>

      {/* Resumo do endereço PJ — apenas para CNPJ que preencheu algum campo de endereço.
          Endereço NÃO é re-perguntado aqui (já coletado no passo do documento);
          este card apenas confirma o que será gravado e a visibilidade pública. */}
      {(data.kind as any) === 'pj' &&
        (Boolean(data.street) ||
          Boolean(data.street_number) ||
          Boolean(data.complement) ||
          Boolean(data.postal_code)) && (
          <div
            data-testid="pj-address-review"
            className="rounded-2xl border border-amber-200/70 bg-amber-50/50 p-4 text-sm text-foreground"
          >
            <div className="mb-2 flex items-center gap-2 font-medium text-amber-900">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              Endereço da empresa (CNPJ)
            </div>
            <ul className="space-y-1 text-[13px] text-muted-foreground">
              {data.postal_code ? <li>CEP: {data.postal_code}</li> : null}
              {(data.street || data.street_number) ? (
                <li>
                  {[data.street, data.street_number].filter(Boolean).join(', ')}
                </li>
              ) : null}
              {data.complement ? <li>Complemento: {data.complement}</li> : null}
            </ul>
            <div className="mt-3 flex items-start gap-2 text-[12px]">
              {data.show_full_address ? (
                <>
                  <Eye className="mt-0.5 h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
                  <span className="text-amber-900">
                    Será <strong>exibido publicamente</strong> no seu perfil.
                  </span>
                </>
              ) : (
                <>
                  <EyeOff className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  <span className="text-muted-foreground">
                    Ficará oculto — apenas bairro e cidade aparecem no perfil público.
                  </span>
                </>
              )}
            </div>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-[12px] text-foreground">
              <input
                type="checkbox"
                checked={Boolean(data.show_full_address)}
                onChange={(e) => onChange({ show_full_address: e.target.checked })}
                className="h-4 w-4 rounded border-amber-300 text-amber-600 focus-visible:ring-2 focus-visible:ring-amber-500"
              />
              Exibir endereço completo no perfil público
            </label>
          </div>
        )}


      <div className="flex flex-col gap-2 pt-1">
        <Button type="button" size="lg" onClick={onFinish} disabled={saving} className={ws.cta}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Concluir cadastro <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
        <Button type="button" variant="ghost" onClick={onSkip} disabled={saving} className={ws.ctaGhost}>
          Pular e concluir
        </Button>
      </div>
    </motion.div>
  );
};
