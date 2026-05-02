/**
 * Step22_Review — Resumo de revisão antes de finalizar (stage local do Shell).
 *
 * Lê do banco (provider, services, portfolio_albums + count de fotos) e
 * mostra um resumo enxuto com:
 *  - Status de cada bloco (Completo / Pendente)
 *  - CTAs "Editar" que disparam onEdit(section) → Shell pula para a fase certa
 *  - CTA principal "Finalizar cadastro" → Shell vai para `done`
 *  - Voltar para Step21 (portfólio).
 *
 * Não persiste nada e não altera o reducer público — é puramente de leitura.
 * Em caso de erro de rede, mostra mensagem clara e botão "Tentar de novo".
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Briefcase,
  FolderOpen,
  Camera,
  UserRound,
  Loader2,
  CircleDashed,
  Copy,
  MessageCircle,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type ReviewSection =
  | 'identity'
  | 'service'
  | 'photos'
  | 'document'
  | 'portfolio'
  | 'extras';

interface Step22Props {
  onBack: () => void;
  onFinalize: () => void;
  onEdit: (section: ReviewSection) => void;
}

interface Snapshot {
  providerOk: boolean;
  servicesCount: number;
  photoCount: number;
  hasPhotos: boolean;
  albumsCount: number;
  hasDocument: boolean;
  hasWorkingHours: boolean;
  hasServiceArea: boolean;
  hasBio: boolean;
  /** 'remote' = Supabase OK; 'local' = veio do draft local (fallback). */
  source: 'remote' | 'local';
  /** Quando o draft local é mais antigo que a versão atual, alertamos o usuário. */
  draftOutdated?: boolean;
  /** Idade do draft local em ms (para mostrar "salvo há X min"). */
  draftAgeMs?: number;
}

// Chave do draft local V2 — mantida em sincronia com flushDraft.ts.
const LOCAL_DRAFT_KEY = 'onboarding_v3_institutional_final';
/**
 * Versão atual do schema do draft local.
 * Quando subimos esta versão, drafts antigos são marcados como "desatualizado"
 * para que o usuário saiba que pode haver divergência com o onboarding atual.
 */
const DRAFT_SCHEMA_VERSION = 'v3.2026-05';
/** Drafts mais antigos que isto (24h) são tratados como potencialmente stale. */
const DRAFT_STALE_AFTER_MS = 1000 * 60 * 60 * 24;

/**
 * Lê o snapshot a partir do draft local quando o Supabase não responde.
 * Não é fonte de verdade — é um fallback de UX para que voltar/continuar
 * não mostre tela vazia ou erro completo se a query falhar transientemente.
 */
function readLocalDraftSnapshot(): Snapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_DRAFT_KEY);
    if (!raw) return null;
    const env = JSON.parse(raw) as {
      profile?: Record<string, any>;
      service?: Record<string, any>;
      providerId?: string | null;
      savedAt?: number;
      schemaVersion?: string;
    };
    const profile = env.profile ?? {};
    const service = env.service ?? {};
    const wh = profile.working_hours_struct ?? service.working_hours_struct;
    const gallery: unknown = service.gallery_urls ?? service.photos;
    const photoCount = Array.isArray(gallery) ? gallery.length : 0;
    const cities: unknown = service.service_area_cities ?? profile.service_area_cities;
    const draftAgeMs = env.savedAt ? Date.now() - env.savedAt : undefined;
    const draftOutdated =
      (env.schemaVersion && env.schemaVersion !== DRAFT_SCHEMA_VERSION) ||
      (draftAgeMs !== undefined && draftAgeMs > DRAFT_STALE_AFTER_MS);
    return {
      providerOk: Boolean(profile.city || profile.cidade),
      servicesCount: service?.id || service?.name ? 1 : 0,
      photoCount,
      hasPhotos: photoCount > 0,
      albumsCount: 0, // não persistido localmente
      hasDocument: Boolean(profile.cpf || profile.cnpj || profile.tax_id),
      hasWorkingHours: Boolean(wh && typeof wh === 'object' && Object.keys(wh).length > 0),
      hasServiceArea: Array.isArray(cities) && cities.length > 0,
      hasBio: Boolean((profile.bio || service.description || '').toString().trim().length >= 20),
      source: 'local',
      draftOutdated,
      draftAgeMs,
    };
  } catch {
    return null;
  }
}

const Step22_Review = ({ onBack, onFinalize, onEdit }: Step22Props) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data: provider, error: pErr } = await supabase
        .from('providers')
        .select('id, business_name, cpf, cnpj, working_hours_struct, city')
        .eq('user_id', user.id)
        .maybeSingle();
      if (pErr) throw pErr;

      let servicesCount = 0;
      let photoCount = 0;
      let albumsCount = 0;
      let hasServiceArea = false;
      if (provider?.id) {
        const [{ count: sCount }, { data: services }, { count: aCount }] = await Promise.all([
          supabase
            .from('services')
            .select('id', { count: 'exact', head: true })
            .eq('provider_id', provider.id),
          supabase
            .from('services')
            .select('id, gallery_urls, cities_served')
            .eq('provider_id', provider.id)
            .limit(5),
          supabase
            .from('portfolio_albums')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id),
        ]);
        servicesCount = sCount ?? 0;
        albumsCount = aCount ?? 0;
        photoCount = (services ?? []).reduce(
          (acc: number, s: any) =>
            acc + (Array.isArray(s.gallery_urls) ? s.gallery_urls.length : 0),
          0,
        );
        hasServiceArea = (services ?? []).some(
          (s: any) => Array.isArray(s.cities_served) && s.cities_served.length > 0,
        );
      }

      const p = provider as any;
      const wh = p?.working_hours_struct;
      setSnap({
        providerOk: Boolean(provider?.id && p?.city),
        servicesCount,
        photoCount,
        hasPhotos: photoCount > 0,
        albumsCount,
        hasDocument: Boolean(p?.cpf || p?.cnpj),
        hasWorkingHours: Boolean(wh && typeof wh === 'object' && Object.keys(wh).length > 0),
        hasServiceArea,
        hasBio: true, // bio não vive em providers; pendência removida do escopo
        source: 'remote',
      });
    } catch (e: any) {
      // Fallback de UX: tenta hidratar com o draft local antes de mostrar erro
      // total. O usuário acabou de preencher tudo no wizard, então o draft
      // costuma estar fresco e suficiente para orientar pendências.
      const fallback = readLocalDraftSnapshot();
      if (fallback) {
        setSnap(fallback);
        setError(null);
      } else {
        setError(
          e?.message?.includes('network') || e?.message?.includes('Failed to fetch')
            ? 'Falha de rede ao carregar seu resumo. Verifique a conexão.'
            : 'Não conseguimos carregar seu resumo agora.',
        );
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-8 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">Carregando seu resumo…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-8 text-center">
        <AlertCircle className="mx-auto h-6 w-6 text-destructive" />
        <p
          role="alert"
          data-testid="step22-error"
          className="mt-2 text-sm text-destructive"
        >
          {error}
        </p>
        <Button type="button" variant="outline" onClick={() => void load()} className="mt-3">
          Tentar de novo
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="mt-2 gap-2 text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
      </div>
    );
  }

  const s = snap!;

  // Cada linha pode ter várias pendências acionáveis. `actions` aparece
  // como bullets curtos abaixo do detail quando a linha não está OK.
  type ReviewItem = {
    key: ReviewSection;
    icon: typeof Briefcase;
    label: string;
    detail: string;
    ok: boolean;
    actions: string[];
  };

  const items: ReviewItem[] = [
    {
      key: 'identity',
      icon: UserRound,
      label: 'Identidade e localização',
      detail: s.providerOk ? 'Cadastro base completo' : 'Falta cidade ou dados básicos',
      ok: s.providerOk,
      actions: s.providerOk ? [] : ['Confirme sua cidade e UF para aparecer nas buscas'],
    },
    {
      key: 'service',
      icon: Briefcase,
      label: 'Serviços',
      detail:
        s.servicesCount === 0
          ? 'Nenhum serviço cadastrado'
          : `${s.servicesCount} serviço${s.servicesCount === 1 ? '' : 's'} ativo${s.servicesCount === 1 ? '' : 's'}`,
      ok: s.servicesCount > 0,
      actions: [
        ...(s.servicesCount === 0 ? ['Cadastre pelo menos 1 serviço'] : []),
        ...(s.hasServiceArea ? [] : ['Defina as cidades onde você atende']),
      ],
    },
    {
      key: 'photos',
      icon: Camera,
      label: 'Fotos do serviço',
      detail: s.hasPhotos
        ? `${s.photoCount} foto${s.photoCount === 1 ? '' : 's'} na galeria`
        : 'Sem fotos — perfis com fotos recebem mais leads',
      ok: s.hasPhotos,
      actions: s.hasPhotos
        ? s.photoCount < 3
          ? [`Adicione mais ${3 - s.photoCount} foto${3 - s.photoCount === 1 ? '' : 's'} (ideal: 3+)`]
          : []
        : ['Adicione pelo menos 1 foto do seu trabalho'],
    },
    {
      key: 'extras',
      icon: CheckCircle2,
      label: 'Horários e documento',
      detail:
        s.hasWorkingHours && s.hasDocument
          ? 'Horários e documento preenchidos'
          : !s.hasWorkingHours && !s.hasDocument
          ? 'Horários e documento pendentes'
          : !s.hasWorkingHours
          ? 'Horários não preenchidos'
          : 'Documento (CPF/CNPJ) opcional não preenchido',
      ok: s.hasWorkingHours,
      actions: [
        ...(s.hasWorkingHours ? [] : ['Complete seus horários de atendimento']),
        ...(s.hasDocument ? [] : ['CPF/CNPJ é opcional, mas aumenta a confiança']),
      ],
    },
    {
      key: 'portfolio',
      icon: FolderOpen,
      label: 'Portfólio',
      detail:
        s.albumsCount === 0
          ? 'Sem álbuns — opcional, mas recomendado'
          : `${s.albumsCount} álbum${s.albumsCount === 1 ? '' : 's'} criado${s.albumsCount === 1 ? '' : 's'}`,
      ok: true, // opcional — não bloqueia
      actions: s.albumsCount === 0
        ? ['Crie 1 álbum para mostrar trabalhos por tema']
        : [],
    },
  ];

  const pendingCount = items.filter((i) => !i.ok).length;
  const totalActions = items.reduce((acc, i) => acc + (i.ok ? 0 : i.actions.length), 0);

  // Texto agregado de pendências para enviar via WhatsApp/Email/clipboard.
  // Não usamos useMemo aqui porque este código vive depois dos early returns
  // (loading/error) e quebraria a regra "mesmo nº de hooks por render".
  const pendingDigestLines = items
    .filter((i) => !i.ok && i.actions.length > 0)
    .map((i) => `• ${i.label}: ${i.actions.join('; ')}`);
  const pendingDigest = pendingDigestLines.length
    ? `Pendências do meu cadastro em precisodeumprofissional.com.br:\n\n${pendingDigestLines.join('\n')}`
    : '';

  const copyText = async (text: string, msg = 'Pendência copiada') => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(msg);
    } catch {
      toast.error('Não consegui copiar agora');
    }
  };

  const sendWhatsApp = (text: string) => {
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const sendEmail = (text: string, subject = 'Pendências do meu cadastro') => {
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    window.location.href = url;
  };

  const minutesOld = s.draftAgeMs ? Math.max(1, Math.round(s.draftAgeMs / 60000)) : null;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-2 space-y-3">
      <header className="text-center space-y-0.5">
        <h2 className="font-display text-lg font-extrabold leading-tight text-foreground">
          Revisão do cadastro
        </h2>
        <p className="text-xs text-muted-foreground">
          {pendingCount === 0
            ? 'Tudo certo! Confira o resumo e finalize.'
            : `${pendingCount} ponto${pendingCount === 1 ? '' : 's'} de atenção${
                totalActions > 0 ? ` · ${totalActions} ação${totalActions === 1 ? '' : 'ões'} sugerida${totalActions === 1 ? '' : 's'}` : ''
              }. Você pode editar agora ou seguir e completar depois.`}
        </p>
        {s.source === 'local' && (
          <p
            data-testid="step22-local-fallback"
            className="mx-auto mt-1 inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800"
          >
            <CircleDashed className="h-3 w-3" aria-hidden /> Resumo offline (rascunho local) — pode estar desatualizado
          </p>
        )}
        {s.source === 'local' && s.draftOutdated && (
          <div
            data-testid="step22-draft-outdated"
            className="mx-auto mt-1 max-w-sm rounded-md border border-amber-400 bg-amber-50/80 p-2 text-left text-[11px] text-amber-900"
          >
            <p className="font-semibold">Rascunho desatualizado</p>
            <p>
              Seu rascunho local{minutesOld ? ` (salvo há ${minutesOld} min)` : ''} é mais antigo que a versão atual do onboarding.
              Pode haver pequenas divergências — recomendamos clicar em <em>“Tentar de novo”</em> com a internet de volta.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void load()}
              className="mt-1.5 h-7 text-[11px]"
            >
              Tentar de novo
            </Button>
          </div>
        )}
      </header>

      {pendingCount > 0 && pendingDigest && (
        <div
          data-testid="step22-digest-actions"
          className="flex flex-wrap items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-muted/30 p-2 text-[11px]"
        >
          <span className="text-muted-foreground">Enviar pendências para mim:</span>
          <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={() => copyText(pendingDigest, 'Pendências copiadas')}>
            <Copy className="h-3 w-3" /> Copiar tudo
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={() => sendWhatsApp(pendingDigest)}>
            <MessageCircle className="h-3 w-3" /> WhatsApp
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={() => sendEmail(pendingDigest)}>
            <Mail className="h-3 w-3" /> E-mail
          </Button>
        </div>
      )}

      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {items.map((it) => {
          const Icon = it.icon;
          const showActions = it.actions.length > 0;
          const itemDigest = it.actions.length
            ? `${it.label}:\n${it.actions.map((a) => `• ${a}`).join('\n')}`
            : '';
          return (
            <li
              key={it.key}
              data-testid={`review-row-${it.key}`}
              className="flex items-start gap-3 p-3"
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  it.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{it.label}</p>
                <p className="text-xs text-muted-foreground">{it.detail}</p>
                {showActions && (
                  <>
                    <ul
                      data-testid={`review-actions-${it.key}`}
                      className="mt-1.5 space-y-0.5 text-[11px] leading-snug text-amber-800"
                    >
                      {it.actions.map((a, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span aria-hidden className="mt-[3px] inline-block h-1 w-1 shrink-0 rounded-full bg-amber-600" />
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                    {itemDigest && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        <button
                          type="button"
                          data-testid={`copy-pendency-${it.key}`}
                          onClick={() => copyText(itemDigest)}
                          className="inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                          aria-label={`Copiar pendência de ${it.label}`}
                        >
                          <Copy className="h-3 w-3" /> Copiar
                        </button>
                        <button
                          type="button"
                          onClick={() => sendWhatsApp(itemDigest)}
                          className="inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                          aria-label={`Enviar pendência de ${it.label} via WhatsApp`}
                        >
                          <MessageCircle className="h-3 w-3" /> WhatsApp
                        </button>
                        <button
                          type="button"
                          onClick={() => sendEmail(itemDigest, `Pendência: ${it.label}`)}
                          className="inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                          aria-label={`Enviar pendência de ${it.label} por e-mail`}
                        >
                          <Mail className="h-3 w-3" /> E-mail
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onEdit(it.key)}
                className="shrink-0 gap-1"
                aria-label={`Editar ${it.label}`}
              >
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onBack} className="flex-1 gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <Button
          type="button"
          onClick={onFinalize}
          className="flex-1 gap-2 bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500 font-semibold text-white"
        >
          Finalizar cadastro <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default Step22_Review;
