/**
 * Phase3 — Tela de Sucesso (compacta + acionável).
 *
 * Mudanças (abr/2026):
 *  - Layout enxuto: CTAs principais visíveis sem scroll.
 *  - Substitui URL pública por: Compartilhar WhatsApp + Copiar link de afiliado
 *    (usa profiles.user_ref para creditar pontos a quem indicou).
 *  - Convite para instalar o app destacado logo após o placar.
 *  - Checklist e "próximos passos" colapsados em "Detalhes" para diminuir altura.
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles, MapPin, Briefcase, ArrowRight, ExternalLink,
  CheckCircle2, Camera, Image as ImageIcon, ShieldCheck, Circle,
  Copy, Check, Share2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import InstallAppCard from '@/components/onboarding/wizard/InstallAppCard';
import { celebrate, CELEBRATION_IDS } from '@/lib/celebrate';
import { supabase } from '@/integrations/supabase/client';
import { whatsappLink } from '@/lib/whatsapp';

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
  required: boolean;
}

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
  useEffect(() => {
    celebrate({
      intensity: 'big',
      id: CELEBRATION_IDS.onboardingComplete(userId || 'anon'),
    });
  }, [userId]);

  const [providerSlug, setProviderSlug] = useState<string | null>(null);
  const [userRef, setUserRef] = useState<string | null>(null);
  const [hasPhotos, setHasPhotos] = useState(false);
  const [hasPortfolio, setHasPortfolio] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      const profRes: any = await (supabase as any).from('profiles').select('user_ref').eq('user_id', userId).maybeSingle();
      const provRes: any = await (supabase as any).from('providers').select('id, slug').eq('user_id', userId).maybeSingle();
      const prof = profRes?.data;
      const prov = provRes?.data;
      if (!alive) return;
      if (prof?.user_ref) setUserRef(prof.user_ref);
      if (prov?.slug) setProviderSlug(prov.slug);
      if (!prov?.id) return;

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

  // Link de afiliado: quem entra por aqui credita pontos ao usuário (via user_ref).
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://precisodeum.com.br';
  const affiliateLink = userRef ? `${origin}/login?ref=${encodeURIComponent(userRef)}` : '';
  const shareMessage = affiliateLink
    ? `Acabei de criar meu perfil no Preciso de Um! Cadastre-se pelo meu link e receba clientes mais rápido: ${affiliateLink}`
    : '';

  const handleCopy = async () => {
    if (!affiliateLink) return;
    try {
      await navigator.clipboard.writeText(affiliateLink);
      setCopied(true);
      toast.success('Link copiado! Compartilhe e ganhe pontos a cada cadastro.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Não foi possível copiar.');
    }
  };

  const handleWhatsApp = () => {
    if (!shareMessage) return;
    window.open(whatsappLink('', shareMessage), '_blank', 'noopener,noreferrer');
  };

  const reach = useTickerNumber(1280, 1300);
  const score = useTickerNumber(73, 1100);
  const visibility = useTickerNumber(94, 900);

  const checklist: ChecklistRow[] = [
    { key: 'profile', label: 'Perfil básico criado', done: true, required: true },
    { key: 'service', label: '1º serviço publicado', done: !!serviceName, required: true },
    { key: 'location', label: 'Cidade e estado definidos', done: !!(city && state), required: true },
    { key: 'photos', label: 'Fotos no serviço', done: hasPhotos, required: false },
    { key: 'portfolio', label: 'Álbum de portfólio', done: hasPortfolio, required: false },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      {/* Topo — celebração compacta */}
      <div className="text-center space-y-2">
        <motion.div
          initial={{ scale: 0.6, rotate: -12 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 14 }}
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent to-primary text-primary-foreground shadow-xl"
        >
          <Sparkles className="h-7 w-7" />
        </motion.div>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Sucesso!</h1>
          <p className="text-xs text-muted-foreground">
            Seu perfil já está no ar.{' '}
            <span className="font-semibold text-foreground">Você está apto a receber clientes.</span>
          </p>
        </div>
      </div>

      {/* Placar compacto */}
      <div className="grid grid-cols-3 gap-2 rounded-2xl border-2 border-accent/30 bg-gradient-to-br from-accent/5 to-primary/5 p-3">
        <div className="text-center">
          <p className="font-display text-lg font-bold tabular-nums text-foreground">{reach.toLocaleString('pt-BR')}</p>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">alcance/mês*</p>
        </div>
        <div className="text-center">
          <p className="font-display text-lg font-bold tabular-nums text-foreground">{score}</p>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">score perfil</p>
        </div>
        <div className="text-center">
          <p className="font-display text-lg font-bold tabular-nums text-foreground">{visibility}%</p>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">visibilidade</p>
        </div>
      </div>

      {/* CTAs principais — visíveis SEM scroll */}
      <div className="space-y-2">
        <Button
          type="button"
          size="lg"
          onClick={onContinue}
          className="group h-12 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-base font-bold text-white shadow-[0_0_24px_rgba(251,146,60,0.55)] hover:opacity-95"
        >
          Continuar para os opcionais <ArrowRight className="ml-2 h-5 w-5 transition group-hover:translate-x-0.5" />
        </Button>

        {affiliateLink && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleWhatsApp}
              className="w-full bg-emerald-500/5 border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10"
            >
              <Share2 className="h-4 w-4 mr-2" /> WhatsApp
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleCopy}
              className="w-full"
            >
              {copied ? <Check className="h-4 w-4 mr-2 text-emerald-600" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? 'Copiado' : 'Copiar link'}
            </Button>
          </div>
        )}
        {affiliateLink && (
          <p className="text-center text-[11px] text-muted-foreground">
            Cada cadastro pelo seu link te dá <span className="font-semibold text-foreground">pontos no ranking</span>.
          </p>
        )}
      </div>

      {/* Instalar app — com destaque */}
      <InstallAppCard source="wizard-phase3-celebration" />

      {/* Resumo simples */}
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

      {/* Detalhes (colapsado) */}
      <button
        type="button"
        onClick={() => setShowDetails((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted"
      >
        <span>Detalhes & próximos passos</span>
        {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {showDetails && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="space-y-3"
        >
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

          <div className="grid gap-2">
            {!hasPhotos && (
              <Button asChild type="button" variant="outline" size="sm" className="justify-start">
                <a href="/dashboard/servicos" className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-primary" />
                  <span className="text-sm">Adicionar fotos no seu serviço</span>
                </a>
              </Button>
            )}
            {!hasPortfolio && (
              <Button asChild type="button" variant="outline" size="sm" className="justify-start">
                <a href="/dashboard/portfolio" className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-primary" />
                  <span className="text-sm">Criar seu 1º álbum de portfólio</span>
                </a>
              </Button>
            )}
            <Button asChild type="button" variant="outline" size="sm" className="justify-start">
              <a href="/dashboard" className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="text-sm">Ir para o Dashboard</span>
              </a>
            </Button>
            {providerSlug && (
              <Button asChild type="button" variant="outline" size="sm" className="justify-start">
                <a href={`/profissional/${providerSlug}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-primary" />
                  <span className="text-sm">Ver minha página pública</span>
                </a>
              </Button>
            )}
          </div>
        </motion.div>
      )}

      <p className="text-center text-[10px] text-muted-foreground">
        *estimativa com base na sua categoria + região
      </p>
    </motion.div>
  );
};
