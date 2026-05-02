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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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
}

// Chave do draft local V2 — mantida em sincronia com flushDraft.ts.
const LOCAL_DRAFT_KEY = 'onboarding_v3_institutional_final';

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
    };
    const profile = env.profile ?? {};
    const service = env.service ?? {};
    const wh = profile.working_hours_struct ?? service.working_hours_struct;
    const gallery: unknown = service.gallery_urls ?? service.photos;
    const photoCount = Array.isArray(gallery) ? gallery.length : 0;
    const cities: unknown = service.service_area_cities ?? profile.service_area_cities;
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
        .select('id, business_name, cpf, cnpj, working_hours_struct, city, bio')
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
        hasBio: Boolean((p?.bio || '').toString().trim().length >= 20),
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
  const items: Array<{
    key: ReviewSection;
    icon: typeof Briefcase;
    label: string;
    detail: string;
    ok: boolean;
  }> = [
    {
      key: 'identity',
      icon: UserRound,
      label: 'Identidade e localização',
      detail: s.providerOk ? 'Cadastro base completo' : 'Falta cidade/dados básicos',
      ok: s.providerOk,
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
    },
    {
      key: 'photos',
      icon: Camera,
      label: 'Fotos do serviço',
      detail: s.hasPhotos ? 'Galeria com fotos' : 'Sem fotos — recomendado adicionar',
      ok: s.hasPhotos,
    },
    {
      key: 'extras',
      icon: CheckCircle2,
      label: 'Horários e extras',
      detail: s.hasWorkingHours ? 'Horários definidos' : 'Horários não preenchidos',
      ok: s.hasWorkingHours,
    },
    {
      key: 'portfolio',
      icon: FolderOpen,
      label: 'Portfólio',
      detail:
        s.albumsCount === 0
          ? 'Sem álbuns — opcional'
          : `${s.albumsCount} álbum${s.albumsCount === 1 ? '' : 's'} criado${s.albumsCount === 1 ? '' : 's'}`,
      ok: true, // opcional — sempre ok
    },
  ];

  const pendingCount = items.filter((i) => !i.ok).length;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-2 space-y-3">
      <header className="text-center space-y-0.5">
        <h2 className="font-display text-lg font-extrabold leading-tight text-foreground">
          Revisão do cadastro
        </h2>
        <p className="text-xs text-muted-foreground">
          {pendingCount === 0
            ? 'Tudo certo! Confira o resumo e finalize.'
            : `${pendingCount} ponto${pendingCount === 1 ? '' : 's'} de atenção. Você pode editar agora ou seguir e completar depois.`}
        </p>
      </header>

      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <li
              key={it.key}
              data-testid={`review-row-${it.key}`}
              className="flex items-center gap-3 p-3"
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
                <p className="truncate text-xs text-muted-foreground">{it.detail}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onEdit(it.key)}
                className="gap-1"
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
