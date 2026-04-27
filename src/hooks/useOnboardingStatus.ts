/**
 * useOnboardingStatus — fonte única do progresso de cadastro do profissional.
 *
 * Centraliza:
 *  - Fetch de contadores (services, media, portfolio_albums)
 *  - Cálculo do checklist com VALIDAÇÃO REAL (sem falso-positivo)
 *  - Auto-refresh por foco/visibility/realtime
 *  - Toast único quando atingir 100% dos obrigatórios
 *
 * Reutilizado por:
 *  - DashboardOnboardingStatusPage (UI principal)
 *  - Wizard V2 (efeito colateral via realtime — quando salva 1º serviço,
 *    se a página de status estiver aberta em outra aba, atualiza sozinha)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { createElement } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/* ───────────────── Validators ───────────────── */

export function isValidCpf(raw: string | null | undefined): boolean {
  const d = (raw || '').replace(/\D/g, '');
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  const calc = (slice: number) => {
    let sum = 0;
    for (let i = 0; i < slice; i++) sum += parseInt(d[i], 10) * (slice + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === parseInt(d[9], 10) && calc(10) === parseInt(d[10], 10);
}

export function isValidCnpj(raw: string | null | undefined): boolean {
  const d = (raw || '').replace(/\D/g, '');
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;
  const calc = (slice: number) => {
    const weights = slice === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < slice; i++) sum += parseInt(d[i], 10) * weights[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === parseInt(d[12], 10) && calc(13) === parseInt(d[13], 10);
}

/**
 * isValidBrPhone — telefone/WhatsApp BR.
 * Aceita 10 ou 11 dígitos (com ou sem 9 inicial), DDD válido (11–99),
 * rejeita sequência repetida (ex: 11111111111).
 */
export function isValidBrPhone(raw: string | null | undefined): boolean {
  const d = (raw || '').replace(/\D/g, '');
  // Remove 55 (código país) se vier
  const local = d.length === 13 || d.length === 12 ? d.slice(2) : d;
  if (local.length !== 10 && local.length !== 11) return false;
  if (/^(\d)\1+$/.test(local)) return false;
  const ddd = parseInt(local.slice(0, 2), 10);
  if (ddd < 11 || ddd > 99) return false;
  // Celular precisa começar com 9 após o DDD
  if (local.length === 11 && local[2] !== '9') return false;
  return true;
}

/**
 * isValidUrl — URL HTTP/HTTPS válida.
 * Aceita "exemplo.com.br" e "https://exemplo.com.br".
 */
export function isValidUrl(raw: string | null | undefined): boolean {
  const v = (raw || '').trim();
  if (!v) return false;
  if (v.length > 2048) return false;
  const withProtocol = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withProtocol);
    if (!u.hostname.includes('.')) return false;
    if (!/^[a-z0-9.-]+$/i.test(u.hostname)) return false;
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/* ───────────────── Hook ───────────────── */

export interface OnboardingChecklistItem {
  key: string;
  label: string;
  description: string;
  done: boolean;
  required: boolean;
  cta?: { label: string; to: string };
}

interface Counts {
  servicesActive: number;
  photos: number;
  albums: number;
}

export interface OnboardingStatus {
  loading: boolean;
  refreshing: boolean;
  items: OnboardingChecklistItem[];
  requiredItems: OnboardingChecklistItem[];
  optionalItems: OnboardingChecklistItem[];
  requiredDone: number;
  optionalDone: number;
  totalDone: number;
  percent: number;
  publishable: boolean;
  missingRequired: OnboardingChecklistItem[];
  refresh: () => Promise<void>;
}

const READY_TOAST_STORAGE_KEY = 'onboarding-ready-toast-shown';

export function useOnboardingStatus(): OnboardingStatus {
  const { user, profile, provider, refetchProfile } = useAuth();
  const [counts, setCounts] = useState<Counts>({ servicesActive: 0, photos: 0, albums: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const lastFetchRef = useRef(0);

  const fetchCounts = useCallback(async (silent = false) => {
    if (!user?.id) { setLoading(false); return; }
    if (!silent) setRefreshing(true);
    try {
      const providerId = provider?.id;
      const [svcRes, photoRes, albumRes] = await Promise.all([
        providerId
          ? (supabase as any).from('services').select('id', { count: 'exact', head: true }).eq('provider_id', providerId).is('deleted_at', null)
          : Promise.resolve({ count: 0 }),
        (supabase as any).from('media').select('id', { count: 'exact', head: true }).eq('owner_id', user.id).eq('entity_type', 'service'),
        providerId
          ? (supabase as any).from('portfolio_albums').select('id', { count: 'exact', head: true }).eq('provider_id', providerId)
          : Promise.resolve({ count: 0 }),
      ]);
      setCounts({
        servicesActive: (svcRes as any)?.count ?? 0,
        photos: (photoRes as any)?.count ?? 0,
        albums: (albumRes as any)?.count ?? 0,
      });
      lastFetchRef.current = Date.now();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, provider?.id]);

  const refresh = useCallback(async () => {
    await Promise.all([refetchProfile?.(), fetchCounts(false)]);
  }, [fetchCounts, refetchProfile]);

  // Carga inicial
  useEffect(() => { void fetchCounts(true); }, [fetchCounts]);

  // Foco / visibility — usuário voltou da aba do Wizard
  useEffect(() => {
    const trigger = () => {
      if (Date.now() - lastFetchRef.current < 4000) return;
      void refresh();
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') trigger(); };
    window.addEventListener('focus', trigger);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', trigger);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh]);

  // Realtime: dispara refresh quando services/media/portfolio_albums mudam.
  // Isso garante que SALVAR no Wizard atualiza o status SEM o usuário voltar.
  useEffect(() => {
    if (!user?.id || !provider?.id) return;
    const channel = (supabase as any)
      .channel(`onb-status-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services', filter: `provider_id=eq.${provider.id}` },
        () => { void fetchCounts(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'media', filter: `owner_id=eq.${user.id}` },
        () => { void fetchCounts(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'portfolio_albums', filter: `provider_id=eq.${provider.id}` },
        () => { void fetchCounts(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `user_id=eq.${user.id}` },
        () => { void refetchProfile?.(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'providers', filter: `user_id=eq.${user.id}` },
        () => { void refetchProfile?.(); })
      .subscribe();
    return () => { try { (supabase as any).removeChannel(channel); } catch { /* noop */ } };
  }, [user?.id, provider?.id, fetchCounts, refetchProfile]);

  // Custom event "onboarding-progress-changed" — disparado pelo Wizard ao
  // salvar serviço/foto/perfil. Garante refresh imediato mesmo sem realtime
  // habilitado nas tabelas correspondentes.
  useEffect(() => {
    const handler = () => { void refresh(); };
    window.addEventListener('onboarding-progress-changed', handler);
    return () => window.removeEventListener('onboarding-progress-changed', handler);
  }, [refresh]);

  /* ── Itens do checklist ── */

  const items: OnboardingChecklistItem[] = useMemo(() => {
    const p: any = profile || {};
    const pr: any = provider || {};
    return [
      {
        key: 'name',
        label: 'Nome completo',
        description: 'Como seus clientes vão te encontrar.',
        done: !!(p.full_name && String(p.full_name).trim().length >= 3 && /\s/.test(String(p.full_name).trim())),
        required: true,
        cta: { label: 'Editar perfil', to: '/dashboard/perfil' },
      },
      {
        key: 'whatsapp',
        label: 'WhatsApp',
        description: 'Canal principal de contato dos leads.',
        done: isValidBrPhone(p.whatsapp),
        required: true,
        cta: { label: 'Editar perfil', to: '/dashboard/perfil' },
      },
      {
        key: 'location',
        label: 'Cidade e estado',
        description: 'Define em quais regiões você aparece.',
        done: !!(p.city && p.state && String(p.state).trim().length === 2),
        required: true,
        cta: { label: 'Editar perfil', to: '/dashboard/perfil' },
      },
      {
        key: 'service',
        label: '1º serviço publicado',
        description: 'Sem serviço, você não aparece nas buscas.',
        done: counts.servicesActive >= 1,
        required: true,
        cta: { label: 'Gerenciar serviços', to: '/dashboard/servicos' },
      },
      {
        key: 'photos',
        label: 'Fotos no serviço',
        description: 'Anúncios com foto recebem até 3x mais leads.',
        done: counts.photos >= 1,
        required: false,
        cta: { label: 'Adicionar fotos', to: '/dashboard/servicos' },
      },
      {
        key: 'portfolio',
        label: 'Álbum de portfólio',
        description: 'Mostre trabalhos anteriores e gere confiança.',
        done: counts.albums >= 1,
        required: false,
        cta: { label: 'Criar portfólio', to: '/dashboard/portfolio' },
      },
      {
        key: 'phone',
        label: 'Telefone alternativo',
        description: 'Aumenta a chance do cliente te alcançar.',
        done: isValidBrPhone(p.phone) && (p.phone || '').replace(/\D/g, '') !== (p.whatsapp || '').replace(/\D/g, ''),
        required: false,
        cta: { label: 'Editar perfil', to: '/dashboard/perfil' },
      },
      {
        key: 'website',
        label: 'Site / portfólio externo',
        description: 'Link para seu site, Instagram ou LinkedIn.',
        done: isValidUrl(pr.website),
        required: false,
        cta: { label: 'Editar perfil', to: '/dashboard/perfil' },
      },
      {
        key: 'document',
        label: 'CPF ou CNPJ',
        description: 'Aumenta a credibilidade e desbloqueia recursos.',
        done: isValidCpf(pr.cpf) || isValidCpf(p.tax_id) || isValidCnpj(pr.cnpj) || isValidCnpj(p.tax_id),
        required: false,
        cta: { label: 'Editar perfil', to: '/dashboard/perfil' },
      },
    ];
  }, [profile, provider, counts]);

  const requiredItems = items.filter((i) => i.required);
  const optionalItems = items.filter((i) => !i.required);
  const requiredDone = requiredItems.filter((i) => i.done).length;
  const optionalDone = optionalItems.filter((i) => i.done).length;
  const totalDone = items.filter((i) => i.done).length;
  const percent = Math.round((totalDone / items.length) * 100);
  const publishable = requiredItems.length > 0 && requiredDone === requiredItems.length;
  const missingRequired = requiredItems.filter((i) => !i.done);

  // Toast de 100% obrigatórios — uma vez por usuário (persistido em localStorage).
  // Re-armado se o usuário "regredir" (desmarcar algum obrigatório).
  const wasPublishableRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (loading) return;
    if (!user?.id) return;
    const storageKey = `${READY_TOAST_STORAGE_KEY}:${user.id}`;
    const previously = wasPublishableRef.current;
    wasPublishableRef.current = publishable;
    if (!publishable) {
      // Permite mostrar o toast novamente se o usuário voltar a 100% depois.
      if (previously === true) {
        try { localStorage.removeItem(storageKey); } catch { /* noop */ }
      }
      return;
    }
    // publishable === true: só dispara se ainda não vimos nesta sessão
    let already = false;
    try { already = localStorage.getItem(storageKey) === '1'; } catch { /* noop */ }
    if (already) return;
    try { localStorage.setItem(storageKey, '1'); } catch { /* noop */ }
    toast.success('Tudo pronto para publicar! 🎉', {
      description: 'Você completou os itens obrigatórios. Revise e publique seu perfil.',
      duration: 8000,
      action: {
        label: 'Revisar e publicar',
        onClick: () => { window.location.assign('/dashboard/status'); },
      },
    });
  }, [publishable, loading, user?.id]);

  return {
    loading,
    refreshing,
    items,
    requiredItems,
    optionalItems,
    requiredDone,
    optionalDone,
    totalDone,
    percent,
    publishable,
    missingRequired,
    refresh,
  };
}

/**
 * notifyOnboardingProgressChanged — chame após salvar algo no Wizard
 * (serviço, foto, perfil) para forçar refresh imediato do checklist
 * em qualquer página que use `useOnboardingStatus`.
 */
export function notifyOnboardingProgressChanged() {
  try { window.dispatchEvent(new CustomEvent('onboarding-progress-changed')); } catch { /* noop */ }
}

// Helper só para evitar lint "createElement não usado" caso o consumidor não use.
void createElement;
void Link;
