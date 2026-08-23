/**
 * DashboardOnboardingStatusPage — Status do onboarding do profissional.
 *
 * Renderiza o checklist e a barra de progresso a partir de `useOnboardingStatus`,
 * que centraliza fetch + validação + auto-refresh (foco/visibility/realtime)
 * + toast de "100% pronto para publicar".
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@/lib/router-compat';
import {
  CheckCircle2, AlertTriangle, Loader2, ArrowRight, RefreshCw,
  User, Phone, MapPin, Briefcase, Camera, ImageIcon, ShieldCheck, Sparkles, Globe, Rocket,
} from 'lucide-react';
import { toast } from 'sonner';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOnboardingStatus, type OnboardingChecklistItem } from '@/hooks/useOnboardingStatus';

const ITEM_ICONS: Record<string, typeof User> = {
  name: User,
  whatsapp: Phone,
  location: MapPin,
  service: Briefcase,
  photos: Camera,
  portfolio: ImageIcon,
  phone: Phone,
  website: Globe,
  document: ShieldCheck,
};

const DashboardOnboardingStatusPage = () => {
  const status = useOnboardingStatus();
  const {
    loading, refreshing, items, requiredItems, optionalItems,
    requiredDone, optionalDone, totalDone, percent, publishable,
    missingRequired, refresh,
  } = status;

  const { provider, refetchProfile } = useAuth();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const isPublished = (provider as any)?.status === 'approved' || (provider as any)?.status === 'active';

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const { data, error } = await (supabase as any).rpc('publish_my_provider');
      if (error) throw error;
      const res = (data || {}) as { ok?: boolean; reason?: string; status?: string; missing?: string[]; already?: boolean };
      if (!res.ok) {
        toast.error('Não foi possível publicar', {
          description: res.reason === 'missing_required'
            ? `Faltam itens obrigatórios: ${(res.missing || []).join(', ')}`
            : 'Verifique seus dados e tente novamente.',
        });
        return;
      }
      await refetchProfile?.();
      await refresh();
      setConfirmOpen(false);
      if (res.already) {
        toast.success('Seu perfil já está publicado.');
      } else {
        toast.success('Perfil publicado com sucesso!', {
          description: 'Você já aparece nas buscas. Boa sorte!',
          action: { label: 'Ver minha página', onClick: () => navigate('/dashboard/minha-pagina') },
        });
      }
    } catch (e: any) {
      toast.error('Erro ao publicar', { description: e?.message || 'Tente novamente em instantes.' });
    } finally {
      setPublishing(false);
    }
  };

  useEffect(() => { document.title = 'Status do cadastro | Preciso de Um'; }, []);

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6">
        <header className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
              <Sparkles className="h-3 w-3" /> Status do cadastro
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { void refresh(); }}
              disabled={refreshing || loading}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
              aria-label="Atualizar status"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="ml-1 hidden sm:inline">Atualizar</span>
            </Button>
          </div>
          <h1 className="font-display text-2xl font-extrabold text-foreground">
            {publishable ? 'Tudo pronto para publicar' : 'Quase lá — falta pouco para publicar'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {publishable
              ? 'Você completou os itens obrigatórios. Continue com os opcionais para ganhar mais visibilidade.'
              : 'Conclua os itens obrigatórios para começar a receber clientes.'}
          </p>
        </header>

        {/* Progresso */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Progresso geral</p>
              <p className="font-display text-3xl font-extrabold text-foreground">
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : `${percent}%`}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {totalDone} de {items.length} concluídos
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p><span className="font-semibold text-foreground">{requiredDone}/{requiredItems.length}</span> obrigatórios</p>
              <p><span className="font-semibold text-foreground">{optionalDone}/{optionalItems.length}</span> opcionais</p>
            </div>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 transition-all"
              style={{ width: `${percent}%` }}
              aria-label={`${percent}% concluído`}
            />
          </div>
        </section>

        {/* CTA — pronto para publicar (ou já publicado) */}
        {!loading && publishable && (
          <div className={`rounded-2xl border p-4 ${isPublished ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-card to-amber-500/5'}`}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-md">
                {isPublished ? <CheckCircle2 className="h-5 w-5" /> : <Rocket className="h-5 w-5" />}
              </div>
              <div className="flex-1 space-y-1.5">
                <p className="text-sm font-bold text-foreground">
                  {isPublished ? 'Seu perfil está publicado' : 'Tudo pronto para publicar'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isPublished
                    ? 'Você já aparece nas buscas. Continue evoluindo seu perfil para ganhar mais visibilidade.'
                    : 'Confirme abaixo para publicar seu perfil e começar a aparecer nas buscas. Você pode editar tudo depois.'}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {isPublished ? (
                    <Button asChild size="sm" variant="outline" className="h-9">
                      <Link to="/dashboard/minha-pagina">
                        Ver minha página <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setConfirmOpen(true)}
                        className="h-9 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white hover:opacity-95"
                      >
                        <Rocket className="mr-1.5 h-4 w-4" /> Publicar meu perfil
                      </Button>
                      <Button asChild size="sm" variant="outline" className="h-9">
                        <Link to="/onboarding-v2?step=review">
                          Revisar antes
                        </Link>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Diálogo de confirmação de publicação */}
        <AlertDialog open={confirmOpen} onOpenChange={(o) => { if (!publishing) setConfirmOpen(o); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Publicar seu perfil agora?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>Ao confirmar, seu perfil ficará visível nas buscas e poderá receber leads.</p>
                  <ul className="rounded-lg border border-border bg-muted/40 p-3 text-xs space-y-1">
                    <li>• Nome: <strong className="text-foreground">{requiredItems.find(i => i.key === 'name')?.done ? 'OK' : '—'}</strong></li>
                    <li>• WhatsApp: <strong className="text-foreground">{requiredItems.find(i => i.key === 'whatsapp')?.done ? 'OK' : '—'}</strong></li>
                    <li>• Cidade/Estado: <strong className="text-foreground">{requiredItems.find(i => i.key === 'location')?.done ? 'OK' : '—'}</strong></li>
                    <li>• 1º serviço: <strong className="text-foreground">{requiredItems.find(i => i.key === 'service')?.done ? 'OK' : '—'}</strong></li>
                  </ul>
                  <p className="text-[11px]">Você pode editar ou despublicar a qualquer momento pelo seu perfil.</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={publishing}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={publishing}
                onClick={(e) => { e.preventDefault(); void handlePublish(); }}
                className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white hover:opacity-95"
              >
                {publishing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Rocket className="mr-1.5 h-4 w-4" />}
                Confirmar publicação
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bloqueio publicação */}
        {!loading && !publishable && (
          <div role="alert" className="rounded-2xl border border-amber-400/40 bg-amber-50 p-3 dark:bg-amber-500/10">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Faltam {missingRequired.length} item(ns) para publicar</p>
                <ul className="list-disc pl-4 text-xs text-muted-foreground">
                  {missingRequired.map((m) => <li key={m.key}>{m.label}</li>)}
                </ul>
                <Button asChild size="sm" className="mt-2 h-9 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white hover:opacity-95">
                  <Link to="/onboarding-v2">Continuar cadastro <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Lista */}
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Obrigatórios</h2>
          <div className="space-y-2">
            {requiredItems.map((item) => <ItemRow key={item.key} item={item} loading={loading} />)}
          </div>

          <h2 className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">Opcionais (recomendados)</h2>
          <div className="space-y-2">
            {optionalItems.map((item) => <ItemRow key={item.key} item={item} loading={loading} />)}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

const ItemRow = ({ item, loading }: { item: OnboardingChecklistItem; loading: boolean }) => {
  const Icon = ITEM_ICONS[item.key] || User;
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 transition ${
      item.done ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border bg-card'
    }`}>
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
        item.done ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted text-muted-foreground'
      }`}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : item.done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{item.label}</p>
        <p className="text-[11px] text-muted-foreground line-clamp-1">{item.description}</p>
      </div>
      {!item.done && item.cta && (
        <Button asChild variant="outline" size="sm" className="h-8 shrink-0 text-xs">
          <Link to={item.cta.to}>{item.cta.label}</Link>
        </Button>
      )}
      {item.done && (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
          <CheckCircle2 className="h-3 w-3" /> ok
        </span>
      )}
    </div>
  );
};

export default DashboardOnboardingStatusPage;
