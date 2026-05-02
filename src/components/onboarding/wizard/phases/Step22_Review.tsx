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
import { useCallback, useEffect, useState } from 'react';
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
  hasPhotos: boolean;
  albumsCount: number;
  hasDocument: boolean;
  hasWorkingHours: boolean;
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
      let hasPhotos = false;
      let albumsCount = 0;
      if (provider?.id) {
        const [{ count: sCount }, { data: services }, { count: aCount }] = await Promise.all([
          supabase
            .from('services')
            .select('id', { count: 'exact', head: true })
            .eq('provider_id', provider.id),
          supabase
            .from('services')
            .select('id, gallery_urls')
            .eq('provider_id', provider.id)
            .limit(5),
          supabase
            .from('portfolio_albums')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id),
        ]);
        servicesCount = sCount ?? 0;
        albumsCount = aCount ?? 0;
        hasPhotos = (services ?? []).some(
          (s: any) => Array.isArray(s.gallery_urls) && s.gallery_urls.length > 0,
        );
      }

      const wh = (provider as any)?.working_hours_struct;
      setSnap({
        providerOk: Boolean(provider?.id && (provider as any)?.city),
        servicesCount,
        hasPhotos,
        albumsCount,
        hasDocument: Boolean((provider as any)?.cpf || (provider as any)?.cnpj),
        hasWorkingHours: Boolean(wh && typeof wh === 'object' && Object.keys(wh).length > 0),
      });
    } catch (e: any) {
      setError(
        e?.message?.includes('network') || e?.message?.includes('Failed to fetch')
          ? 'Falha de rede ao carregar seu resumo. Verifique a conexão.'
          : 'Não conseguimos carregar seu resumo agora.',
      );
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
