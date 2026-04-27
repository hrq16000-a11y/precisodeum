/**
 * DashboardOnboardingStatusPage — Status do onboarding do profissional.
 *
 * Mostra progresso visual + checklist do que falta para o perfil ficar
 * 100% publicado. Reusa a mesma fonte de verdade da Phase3Celebration:
 *  - profiles (full_name, whatsapp, city, state)
 *  - providers (slug, document)
 *  - services (1+ ativos)
 *  - media (fotos do serviço)
 *  - portfolio_albums (álbum criado)
 *
 * Seguro por desenho: apenas SELECTs filtrados por user_id (RLS-friendly).
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, Circle, AlertTriangle, Loader2, ArrowRight,
  User, Phone, MapPin, Briefcase, Camera, ImageIcon, ShieldCheck, Sparkles,
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';


interface ChecklistItem {
  key: string;
  label: string;
  description: string;
  icon: typeof User;
  done: boolean;
  required: boolean;
  cta?: { label: string; to: string };
}

interface Counts {
  servicesActive: number;
  photos: number;
  albums: number;
}

const DashboardOnboardingStatusPage = () => {
  const { user, profile, provider } = useAuth();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Counts>({ servicesActive: 0, photos: 0, albums: 0 });

  useEffect(() => {
    document.title = 'Status do cadastro | Preciso de Um';
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user?.id) { setLoading(false); return; }
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

        if (!alive) return;
        setCounts({
          servicesActive: (svcRes as any)?.count ?? 0,
          photos: (photoRes as any)?.count ?? 0,
          albums: (albumRes as any)?.count ?? 0,
        });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [user?.id, provider?.id]);

  const items: ChecklistItem[] = useMemo(() => [
    {
      key: 'name',
      label: 'Nome completo',
      description: 'Como seus clientes vão te encontrar.',
      icon: User,
      done: !!(profile?.full_name && String(profile.full_name).trim().length >= 3),
      required: true,
      cta: { label: 'Editar perfil', to: '/dashboard/perfil' },
    },
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      description: 'Canal principal de contato dos leads.',
      icon: Phone,
      done: !!(profile?.whatsapp && String(profile.whatsapp).replace(/\D/g, '').length >= 10),
      required: true,
      cta: { label: 'Editar perfil', to: '/dashboard/perfil' },
    },
    {
      key: 'location',
      label: 'Cidade e estado',
      description: 'Define em quais regiões você aparece.',
      icon: MapPin,
      done: !!(profile?.city && profile?.state),
      required: true,
      cta: { label: 'Editar perfil', to: '/dashboard/perfil' },
    },
    {
      key: 'service',
      label: '1º serviço publicado',
      description: 'Sem serviço, você não aparece nas buscas.',
      icon: Briefcase,
      done: counts.servicesActive >= 1,
      required: true,
      cta: { label: 'Gerenciar serviços', to: '/dashboard/servicos' },
    },
    {
      key: 'photos',
      label: 'Fotos no serviço',
      description: 'Anúncios com foto recebem até 3x mais leads.',
      icon: Camera,
      done: counts.photos >= 1,
      required: false,
      cta: { label: 'Adicionar fotos', to: '/dashboard/servicos' },
    },
    {
      key: 'portfolio',
      label: 'Álbum de portfólio',
      description: 'Mostre trabalhos anteriores e gere confiança.',
      icon: ImageIcon,
      done: counts.albums >= 1,
      required: false,
      cta: { label: 'Criar portfólio', to: '/dashboard/portfolio' },
    },
    {
      key: 'document',
      label: 'CPF ou CNPJ',
      description: 'Aumenta a credibilidade e desbloqueia recursos.',
      icon: ShieldCheck,
      done: !!(provider?.cpf || provider?.cnpj || (profile as any)?.tax_id),
      required: false,
      cta: { label: 'Editar perfil', to: '/dashboard/perfil' },
    },
  ], [profile, provider, counts]);

  const requiredItems = items.filter((i) => i.required);
  const optionalItems = items.filter((i) => !i.required);
  const requiredDone = requiredItems.filter((i) => i.done).length;
  const optionalDone = optionalItems.filter((i) => i.done).length;
  const totalDone = items.filter((i) => i.done).length;
  const percent = Math.round((totalDone / items.length) * 100);
  const publishable = requiredDone === requiredItems.length;
  const missingRequired = requiredItems.filter((i) => !i.done);

  return (
    <DashboardLayout>

      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6">
        <header className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
            <Sparkles className="h-3 w-3" /> Status do cadastro
          </div>
          <h1 className="font-display text-2xl font-extrabold text-foreground">
            {publishable ? 'Seu perfil está publicado' : 'Quase lá — falta pouco para publicar'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {publishable
              ? 'Você já aparece nas buscas. Complete os opcionais para ganhar mais visibilidade.'
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

const ItemRow = ({ item, loading }: { item: ChecklistItem; loading: boolean }) => {
  const Icon = item.icon;
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
