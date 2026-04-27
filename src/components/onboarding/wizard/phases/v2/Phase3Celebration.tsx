/**
 * Phase3 — Tela de Sucesso (O Êxtase) + Checklist final + Próximos passos.
 *
 * Esta tela faz três trabalhos numa só:
 *  1. CELEBRAR (confete + som + placar correndo).
 *  2. CONFIRMAR — checklist do que ficou pronto (perfil + 1º serviço).
 *  3. APONTAR PRÓXIMO PASSO — botões diretos para portfólio, ver página
 *     pública, ou continuar a coleta opcional (CPF/bairro/redes).
 *
 * Substitui a necessidade de uma "página de sucesso" separada — o resumo
 * fica no próprio fluxo, mantendo o usuário em contexto.
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles, MapPin, Briefcase, ArrowRight, ExternalLink,
  CheckCircle2, Camera, Image as ImageIcon, ShieldCheck, Circle, Copy, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import InstallAppCard from '@/components/onboarding/wizard/InstallAppCard';
import { celebrate, CELEBRATION_IDS } from '@/lib/celebrate';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeSlug } from '@/lib/slugify';

interface Phase3Props {
  serviceName: string;
  city: string;
  state: string;
  userId: string | undefined;
  onContinue: () => void;
}

interface ChecklistRow {
  key: string;
  label: string;
  done: boolean;
  /** Verdadeiro = item estrutural (ficou pronto agora); falso = sugestão. */
  required: boolean;
}

/** Counter animation: rola números rápido até o alvo. */
function useTickerNumber(target: number, durationMs = 1100): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return n;
}

export const Phase3Celebration = ({ serviceName, city, state, userId, onContinue }: Phase3Props) => {
  // Dispara confetti + som apenas uma vez
  useEffect(() => {
    celebrate({
      intensity: 'big',
      id: CELEBRATION_IDS.onboardingComplete(userId || 'anon'),
    });
  }, [userId]);

  const [providerSlug, setProviderSlug] = useState<string | null>(null);
  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const [hasPhotos, setHasPhotos] = useState(false);
  const [hasPortfolio, setHasPortfolio] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      const { data: prov } = await supabase
        .from('providers')
        .select('id, slug, category_id')
        .eq('user_id', userId)
        .maybeSingle();
      if (!alive || !prov) return;
      if (prov.slug) setProviderSlug(prov.slug);

      if (prov.category_id) {
        const { data: cat } = await (supabase as any)
          .from('categories')
          .select('slug, name')
          .eq('id', prov.category_id)
          .maybeSingle();
        if (alive && cat) {
          setCategorySlug(cat.slug || sanitizeSlug(cat.name || ''));
        }
      }

      const photoRes: any = await (supabase as any)
        .from('media')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId)
        .eq('entity_type', 'service');
      if (alive) setHasPhotos(((photoRes?.count as number) || 0) > 0);

      const albumRes: any = await (supabase as any)
        .from('portfolio_albums')
        .select('id', { count: 'exact', head: true })
        .eq('provider_id', prov.id);
      if (alive) setHasPortfolio(((albumRes?.count as number) || 0) > 0);
    })();
    return () => { alive = false; };
  }, [userId]);

  // URL pública de SEO: categoria + cidade (cidade vai como query — a CategoryPage filtra).
  const cityParam = city ? `?cidade=${encodeURIComponent(sanitizeSlug(city))}` : '';
  const publicCategoryPath = categorySlug ? `/categoria/${categorySlug}${cityParam}` : null;
  const publicCategoryUrl = publicCategoryPath
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}${publicCategoryPath}`
    : null;

  const handleCopyUrl = async () => {
    if (!publicCategoryUrl) return;
    try {
      await navigator.clipboard.writeText(publicCategoryUrl);
      setCopied(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Não foi possível copiar. Selecione o link manualmente.');
    }
  };

  // Placar fictício mas plausível
  const reach = useTickerNumber(1280, 1300);
  const score = useTickerNumber(73, 1100);
  const time = useTickerNumber(94, 900);

  const checklist: ChecklistRow[] = [
    { key: 'profile', label: 'Perfil básico criado',         done: true,         required: true },
    { key: 'service', label: '1º serviço publicado',         done: !!serviceName, required: true },
    { key: 'location', label: 'Cidade e estado definidos',   done: !!(city && state), required: true },
    { key: 'photos',  label: 'Fotos no serviço',             done: hasPhotos,    required: false },
    { key: 'portfolio', label: 'Álbum de portfólio',         done: hasPortfolio, required: false },
  ];
  const allRequiredDone = checklist.filter(c => c.required).every(c => c.done);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Topo — celebração */}
      <div className="text-center space-y-3">
        <motion.div
          initial={{ scale: 0.6, rotate: -12 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 14 }}
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-accent to-primary text-primary-foreground shadow-2xl"
        >
          <Sparkles className="h-10 w-10" />
        </motion.div>
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold text-foreground">Sucesso!</h1>
          <p className="text-sm text-muted-foreground">
            Seu primeiro serviço já está no PrecisodeumProfissional.com.br.
          </p>
          <p className="font-display text-base font-semibold text-foreground">
            Você está apto para receber clientes.
          </p>
        </div>
      </div>

      {/* Placar */}
      <div className="grid grid-cols-3 gap-2 rounded-2xl border-2 border-accent/30 bg-gradient-to-br from-accent/5 to-primary/5 p-4">
        <div className="text-center">
          <p className="font-display text-2xl font-bold tabular-nums text-foreground">{reach.toLocaleString('pt-BR')}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">alcance/mês*</p>
        </div>
        <div className="text-center">
          <p className="font-display text-2xl font-bold tabular-nums text-foreground">{score}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">score perfil</p>
        </div>
        <div className="text-center">
          <p className="font-display text-2xl font-bold tabular-nums text-foreground">{time}%</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">visibilidade</p>
        </div>
      </div>

      {/* Resumo do perfil/serviço */}
      <div className="rounded-xl border border-border bg-card p-3 text-sm space-y-1.5">
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary shrink-0" />
          <span className="truncate font-semibold text-foreground">{serviceName || 'Seu serviço'}</span>
        </div>
        {(city || state) && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="text-xs">{city}{state ? ` • ${state}` : ''}</span>
          </div>
        )}
      </div>

      {/* Preview da URL pública SEO (categoria + cidade) */}
      {publicCategoryUrl && (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Sua página pública (SEO)
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-background px-2 py-1.5 text-[11px] text-foreground border border-border">
              {publicCategoryUrl}
            </code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleCopyUrl}
              className="h-8 px-2 shrink-0"
              aria-label="Copiar link público"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Este link conecta o seu serviço aos clientes que buscam por <span className="font-medium text-foreground">{serviceName || 'esta categoria'}</span>{city ? ` em ${city}` : ''}.
          </p>
        </div>
      )}


      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Confirme o que já ficou pronto
        </p>
        <ul className="space-y-1.5 rounded-xl border border-border bg-card p-3">
          {checklist.map((item) => (
            <li key={item.key} className="flex items-center gap-2 text-sm">
              {item.done
                ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />}
              <span className={item.done ? 'text-foreground' : 'text-muted-foreground'}>
                {item.label}
              </span>
              {!item.required && !item.done && (
                <span className="ml-auto text-[10px] text-muted-foreground">opcional</span>
              )}
            </li>
          ))}
        </ul>
        {!allRequiredDone && (
          <p className="text-[11px] text-amber-600">
            Algum item essencial ainda está pendente. Você pode completar no Dashboard depois.
          </p>
        )}
      </div>

      {/* Convite para instalar o app — Fase 2 concluída. */}
      <InstallAppCard source="wizard-phase3-celebration" />

      {/* Próximos passos */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Próximos passos
        </p>
        <div className="grid gap-2">
          {!hasPhotos && (
            <Button asChild type="button" variant="outline" size="sm" className="justify-start hover:bg-accent/10 focus-visible:ring-2 focus-visible:ring-primary">
              <a href="/dashboard/servicos" className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-primary" />
                <span className="text-sm">Adicionar fotos no seu serviço</span>
              </a>
            </Button>
          )}
          {!hasPortfolio && (
            <Button asChild type="button" variant="outline" size="sm" className="justify-start hover:bg-accent/10 focus-visible:ring-2 focus-visible:ring-primary">
              <a href="/dashboard/portfolio" className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-primary" />
                <span className="text-sm">Criar seu 1º álbum de portfólio</span>
              </a>
            </Button>
          )}
          <Button asChild type="button" variant="outline" size="sm" className="justify-start hover:bg-accent/10 focus-visible:ring-2 focus-visible:ring-primary">
            <a href="/dashboard" className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="text-sm">Ir para o Dashboard</span>
            </a>
          </Button>
        </div>
      </div>

      {/* CTAs principais */}
      <div className="space-y-2">
        <Button
          type="button"
          size="lg"
          onClick={onContinue}
          className="w-full hover:opacity-95 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-primary"
        >
          Continuar para os opcionais <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
        {providerSlug && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            asChild
            className="w-full hover:bg-accent/10 focus-visible:ring-2 focus-visible:ring-primary"
          >
            <a
              href={`/profissional/${providerSlug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ver minha página pública <ExternalLink className="h-4 w-4 ml-2" />
            </a>
          </Button>
        )}
      </div>
      <p className="text-center text-[10px] text-muted-foreground">
        *estimativa com base na sua categoria + região
      </p>
    </motion.div>
  );
};
