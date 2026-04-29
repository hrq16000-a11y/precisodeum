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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ArrowRight, SkipForward, CheckCircle2, LayoutDashboard, UserRound } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import ServiceWizard from '@/components/dashboard/ServiceWizard';
import { Button } from '@/components/ui/button';

const MAX_SERVICES = 5;

interface Step20Props {
  onContinue: () => void;
  onSkip: () => void;
}

const Step20_MoreServices = ({ onContinue, onSkip }: Step20Props) => {
  const { user, provider } = useAuth();
  const [count, setCount] = useState<number | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState(false);
  const [providerFull, setProviderFull] = useState<any>(provider);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    const { count: c } = await supabase
      .from('services')
      .select('id', { count: 'exact', head: true })
      .eq('provider_id', providerFull?.id ?? '');
    setCount(c ?? 0);
  }, [user?.id, providerFull?.id]);

  // Carrega provider completo (caso o context ainda não tenha) + categorias
  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingProvider(true);
      try {
        let prov = providerFull;
        if (!prov?.id && user?.id) {
          const { data } = await supabase
            .from('providers')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
          if (data) prov = data;
        }
        const { data: cats } = await supabase
          .from('categories')
          .select('id, name, slug, icon, parent_id')
          .order('name');
        if (!active) return;
        setProviderFull(prov);
        setCategories(cats || []);
      } finally {
        if (active) setLoadingProvider(false);
      }
    })();
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => { void refresh(); }, [refresh]);

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
    <div className="mx-auto w-full max-w-md px-4 py-6 space-y-5">
      <header className="text-center space-y-1">
        <h2 className="text-xl font-semibold">Quer cadastrar mais serviços?</h2>
        <p className="text-sm text-muted-foreground">
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
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <>
            <div className="text-3xl font-bold text-foreground">{count}<span className="text-base text-muted-foreground"> / {MAX_SERVICES}</span></div>
            <p className="mt-1 text-xs text-muted-foreground">
              {reachedCap ? 'Limite atingido — perfil completo de serviços!' : `${remaining} restante${remaining === 1 ? '' : 's'}`}
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
            Você pode adicionar, editar ou remover serviços a qualquer momento pelo painel.
          </p>
        </div>
      )}
    </div>
  );
};

export default Step20_MoreServices;
