/**
 * Step20_MoreServices — Wizard linear, fase opcional.
 *
 * Permite ao prestador cadastrar até MAIS 4 serviços (totalizando 5 com o
 * primeiro já criado nas fases anteriores). Reutiliza o `ServiceWizard`
 * existente do dashboard como editor por serviço, evitando duplicar lógica.
 *
 * Comportamento:
 *  - Mostra contagem atual de serviços do provider.
 *  - Botão "Adicionar serviço" abre o ServiceWizard inline; ao concluir,
 *    incrementa a contagem.
 *  - Sempre exibe "Pular" e "Continuar" — o passo é 100% opcional.
 *  - Quando atinge 5 serviços, esconde o botão de adicionar.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@/lib/router-compat';
import { Plus, ArrowRight, SkipForward, CheckCircle2, LayoutDashboard, UserRound, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { PROVIDER_SAFE_COLUMNS } from '@/lib/dbSafeColumns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import ServiceWizard from '@/components/dashboard/ServiceWizard';
import { Button } from '@/components/ui/button';
import { subscribeDraftChange } from './v2/crossTabSync';

const MAX_SERVICES = 5;

interface Step20Props {
  onBack?: () => void;
  onContinue: () => void;
  onSkip: () => void;
  onGoToPath?: (path: string) => Promise<void> | void;
}

const Step20_MoreServices = ({ onBack, onContinue, onSkip, onGoToPath }: Step20Props) => {
  const { user, provider } = useAuth();
  const navigate = useNavigate();
  const [navigating, setNavigating] = useState<string | null>(null);

  const goTo = useCallback(async (path: string) => {
    setNavigating(path);
    try {
      if (onGoToPath) {
        await onGoToPath(path);
      } else {
        navigate(path);
      }
    } finally {
      setNavigating(null);
    }
  }, [navigate, onGoToPath]);

  const [count, setCount] = useState<number | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState(false);
  const [providerFull, setProviderFull] = useState<any>(provider);
  const [providerError, setProviderError] = useState<string | null>(null);
  const refreshMsRef = useRef<number | null>(null);
  const providerLoadMsRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    const startedAt = performance.now();
    const { count: c } = await supabase
      .from('services')
      .select('id', { count: 'exact', head: true })
      .eq('provider_id', providerFull?.id ?? '');
    refreshMsRef.current = Math.round(performance.now() - startedAt);
    setCount(c ?? 0);
  }, [user?.id, providerFull?.id]);

  // Carrega provider completo (caso o context ainda não tenha) + categorias
  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingProvider(true);
      setProviderError(null);
      const startedAt = performance.now();
      try {
        let prov = providerFull;
        if (!prov?.id && user?.id) {
          const { data, error } = await supabase
            .from('providers')
            .select(PROVIDER_SAFE_COLUMNS)
            .eq('user_id', user.id)
            .maybeSingle();
          if (error) throw error;
          if (data) prov = data;
        }
        const { data: cats } = await supabase
          .from('categories')
          .select('id, name, slug, icon, parent_id')
          .order('name');
        if (!active) return;
        providerLoadMsRef.current = Math.round(performance.now() - startedAt);
        setProviderFull(prov);
        setCategories(cats || []);
      } catch (e: any) {
        if (!active) return;
        setProviderError(e?.message || 'Falha ao carregar dados.');
      } finally {
        if (active) setLoadingProvider(false);
      }
    })();
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const unsubscribeDraft = subscribeDraftChange(() => { void refresh(); });
    const onProgressChanged = () => { void refresh(); };
    window.addEventListener('visibilitychange', onVisible);
    window.addEventListener('onboarding-progress-changed', onProgressChanged as EventListener);
    return () => {
      unsubscribeDraft();
      window.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('onboarding-progress-changed', onProgressChanged as EventListener);
    };
  }, [refresh]);

  const remaining = count == null ? null : Math.max(0, MAX_SERVICES - count);
  const reachedCap = count != null && count >= MAX_SERVICES;
  const statusCopy = useMemo(() => {
    if (count == null) return 'Carregando…';
    if (reachedCap) return 'Seu primeiro serviço já está garantido e o limite foi atingido. Agora você pode ir direto para o painel ou revisar sua página pública.';
    if (count <= 1) return 'Seu primeiro serviço já está salvo. Se quiser, adicione outro agora ou siga para o painel.';
    return `Você já tem ${count} serviços ativos. Pode adicionar mais ${remaining} ou seguir para a próxima etapa.`;
  }, [count, reachedCap, remaining]);

  const handleServiceCreated = useCallback(async () => {
    setEditorOpen(false);
    await refresh();
  }, [refresh]);

  return (
    <div className="mx-auto w-full max-w-md px-4 py-2 space-y-2.5">
      <header className="text-center space-y-0.5">
        <h2 className="font-display text-lg font-extrabold leading-tight text-foreground">Quer cadastrar mais serviços?</h2>
        <p className="text-xs text-muted-foreground">
          Você pode ter até <span className="font-medium text-foreground">{MAX_SERVICES} serviços</span> no perfil.
          Cadastrar agora aumenta suas chances de receber leads. Pode pular e fazer depois pelo painel.
        </p>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-border bg-card p-4 text-center"
      >
        {count == null || loadingProvider ? (
          <div data-testid="step20-loading" aria-live="polite" className="space-y-2">
            <div className="mx-auto h-8 w-20 animate-pulse rounded bg-muted" />
            <div className="mx-auto h-3 w-32 animate-pulse rounded bg-muted/70" />
            <p className="text-xs text-muted-foreground">Carregando seus serviços…</p>
          </div>
        ) : (
          <>
            <div className="text-3xl font-bold text-foreground">{count}<span className="text-base text-muted-foreground"> / {MAX_SERVICES}</span></div>
            <p className="mt-1 text-xs text-muted-foreground">
              {reachedCap ? 'Limite atingido — perfil completo de serviços!' : `${remaining} restante${remaining === 1 ? '' : 's'}`}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {statusCopy}
            </p>
          </>
        )}
      </motion.div>

      {editorOpen && providerFull?.id && user?.id ? (
        <div className="rounded-lg border border-accent/40 bg-background">
          <ServiceWizard
            providerId={providerFull.id}
            userId={user.id}
            provider={providerFull}
            categories={categories}
            serviceNumber={(count ?? 0) + 1}
            maxServices={MAX_SERVICES}
            onComplete={handleServiceCreated}
            onCancel={() => setEditorOpen(false)}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {!reachedCap && providerFull?.id && (
            <Button
              type="button"
              onClick={() => setEditorOpen(true)}
              className="w-full gap-2"
              variant="outline"
            >
              <Plus className="h-4 w-4" /> Adicionar mais um serviço
            </Button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={navigating !== null}
              onClick={() => void goTo('/dashboard')}
            >
              <LayoutDashboard className="h-4 w-4" /> Ir para meu painel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={navigating !== null}
              onClick={() => void goTo('/dashboard/minha-pagina')}
            >
              <UserRound className="h-4 w-4" /> Ir para meu perfil
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onSkip}
              className="flex-1 gap-2"
            >
              <SkipForward className="h-4 w-4" /> Pular
            </Button>
            <Button
              type="button"
              onClick={onContinue}
              className="flex-1 gap-2"
            >
              {count && count > 1 ? <CheckCircle2 className="h-4 w-4" /> : null}
              Continuar
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-center text-[11px] text-muted-foreground">
            Serviços extras podem ser criados depois em <span className="font-medium">Painel → Serviços</span>.
          </p>
        </div>
      )}

      {providerError && (
        <div
          role="alert"
          data-testid="step20-provider-error"
          className="space-y-1 rounded border border-destructive/40 bg-destructive/10 px-2 py-2 text-xs text-destructive"
        >
          <p className="flex items-center gap-1.5 font-medium">
            <AlertCircle className="h-3.5 w-3.5" aria-hidden />
            Ocorreu um erro ao carregar seus dados.
          </p>
          <p className="text-[11px] text-destructive/80">
            Você pode voltar ao passo anterior ou salvar e continuar depois.
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        {onBack && (
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="flex-1 gap-2"
          >
            ← Voltar
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="flex-1 gap-2"
          disabled={navigating !== null}
          onClick={() => void goTo('/dashboard')}
        >
          Salvar para depois →
        </Button>
      </div>
    </div>
  );
};

export default Step20_MoreServices;
