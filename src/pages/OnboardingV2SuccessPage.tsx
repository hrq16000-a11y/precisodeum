/**
 * OnboardingV2SuccessPage — página dedicada pós-conclusão do Onboarding V2.
 *
 * Apresenta um resumo do perfil + 1º serviço, com CTAs claros para
 * Dashboard e perfil público. Diferente da Phase3Celebration (que vive
 * dentro do wizard), esta é uma rota standalone que pode ser referenciada
 * via link direto ou voltar (ex: do email).
 */

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Sparkles, ExternalLink, ArrowRight, Briefcase, MapPin, Camera,
  ImageIcon, ShieldCheck, CheckCircle2, Circle, Share2, Copy, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useAuthIdentity } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { celebrate, CELEBRATION_IDS } from '@/lib/celebrate';
import { toast } from 'sonner';
import { whatsappLink } from '@/lib/whatsapp';
import InstallAppCard from '@/components/onboarding/wizard/InstallAppCard';

interface ProviderSummary {
  id: string;
  slug: string | null;
  city: string | null;
  state: string | null;
  status: string | null;
}

interface ServiceSummary {
  id: string;
  service_name: string;
  service_area: string | null;
}

interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  required: boolean;
}

const OnboardingV2SuccessPage = () => {
  const { user, loading: authLoading } = useAuthIdentity();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<ProviderSummary | null>(null);
  const [service, setService] = useState<ServiceSummary | null>(null);
  const [hasPhotos, setHasPhotos] = useState(false);
  const [hasPortfolio, setHasPortfolio] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [userRef, setUserRef] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Celebra uma única vez por usuário
  useEffect(() => {
    if (!user?.id) return;
    celebrate({
      intensity: 'big',
      id: CELEBRATION_IDS.onboardingComplete(user.id),
    });
  }, [user?.id]);

  // Carrega resumo — fail-soft em CADA query para nunca derrubar a página.
  // Mesmo que o provider/serviço/foto/álbum falhem, o dashboard CTA permanece visível.
  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      navigate('/login?next=/onboarding-v2/sucesso', { replace: true });
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        try {
          const { data: prof } = await supabase
            .from('profiles')
            .select('full_name, user_ref')
            .eq('id', user.id)
            .maybeSingle();
          if (alive && prof?.full_name) setProfileName(prof.full_name);
          if (alive && (prof as any)?.user_ref) setUserRef((prof as any).user_ref);
        } catch (e) { console.debug('[success] profile load failed', e); }

        let prov: ProviderSummary | null = null;
        try {
          const { data } = await supabase
            .from('providers')
            .select('id, slug, city, state, status')
            .eq('user_id', user.id)
            .maybeSingle();
          if (alive && data) {
            prov = data as ProviderSummary;
            setProvider(prov);
          }
        } catch (e) { console.debug('[success] provider load failed', e); }

        if (prov?.id) {
          try {
            const { data: svc } = await supabase
              .from('services')
              .select('id, service_name, service_area')
              .eq('provider_id', prov.id)
              .order('created_at', { ascending: true })
              .limit(1);
            if (alive && svc && svc[0]) setService(svc[0] as ServiceSummary);
          } catch (e) { console.debug('[success] service load failed', e); }

          try {
            const photoRes: any = await (supabase as any)
              .from('media')
              .select('id', { count: 'estimated', head: true })
              .eq('owner_id', user.id)
              .eq('entity_type', 'service');
            if (alive) setHasPhotos(((photoRes?.count as number) || 0) > 0);
          } catch (e) { console.debug('[success] photos load failed', e); }

          try {
            const albumRes: any = await (supabase as any)
              .from('portfolio_albums')
              .select('id', { count: 'estimated', head: true })
              .eq('provider_id', prov.id);
            if (alive) setHasPortfolio(((albumRes?.count as number) || 0) > 0);
          } catch (e) { console.debug('[success] albums load failed', e); }
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [user?.id, authLoading, navigate]);

  const checklist: ChecklistItem[] = [
    { key: 'profile', label: 'Perfil básico criado', done: !!profileName, required: true },
    { key: 'service', label: '1º serviço publicado', done: !!service, required: true },
    { key: 'location', label: 'Cidade e estado definidos', done: !!(provider?.city && provider?.state), required: true },
    { key: 'photos', label: 'Fotos no serviço', done: hasPhotos, required: false },
    { key: 'portfolio', label: 'Álbum de portfólio', done: hasPortfolio, required: false },
  ];

  const isOnline = provider?.status === 'active';

  // Link de afiliado: quem se cadastra por aqui credita pontos via user_ref.
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://precisodeum.com.br';
  const affiliateLink = userRef ? `${origin}/login?ref=${encodeURIComponent(userRef)}` : '';
  const defaultMessage = affiliateLink
    ? `Acabei de criar meu perfil no Preciso de Um! Cadastre-se pelo meu link: ${affiliateLink}`
    : '';
  const [shareMessage, setShareMessage] = useState(defaultMessage);

  // Hidrata o textarea quando o link chegar (e mantém edição do usuário).
  useEffect(() => {
    if (defaultMessage && !shareMessage) setShareMessage(defaultMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultMessage]);

  // Timer rastreado do reset de "copiado" — limpo no unmount para evitar
  // setState em componente morto se o usuário sair da página em <2s.
  const copyResetTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (copyResetTimer.current) window.clearTimeout(copyResetTimer.current);
  }, []);

  const handleCopy = async () => {
    if (!affiliateLink) return;
    try {
      await navigator.clipboard.writeText(affiliateLink);
      setCopied(true);
      toast.success('Link copiado! Compartilhe e ganhe pontos a cada cadastro.');
      if (copyResetTimer.current) window.clearTimeout(copyResetTimer.current);
      copyResetTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Não foi possível copiar.');
    }
  };

  const handleWhatsApp = () => {
    const msg = (shareMessage || defaultMessage).trim();
    if (!msg) return;
    window.open(whatsappLink('', msg), '_blank', 'noopener,noreferrer');
  };

  const resetMessage = () => setShareMessage(defaultMessage);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-accent/5 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Cabeçalho de celebração */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-3"
        >
          <motion.div
            initial={{ scale: 0.6, rotate: -12 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 14 }}
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-accent to-primary text-primary-foreground shadow-2xl"
          >
            <Sparkles className="h-10 w-10" />
          </motion.div>
          <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
            Tudo pronto{profileName ? `, ${profileName.split(' ')[0]}` : ''}!
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Seu perfil profissional já está ativo no PrecisodeumProfissional.com.br.
          </p>
          {provider && (
            <Badge
              variant="secondary"
              className={isOnline
                ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-700 border border-amber-500/30'}
            >
              {isOnline ? 'Status: ONLINE' : 'Status: Aguardando verificação'}
            </Badge>
          )}
        </motion.header>

        {/* Resumo do perfil + serviço */}
        <Card>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-foreground">Resumo do que ficou pronto</h2>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-5 w-2/3" />
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <Briefcase className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-foreground">
                      {service?.service_name || 'Nenhum serviço cadastrado ainda'}
                    </p>
                    {service?.service_area && (
                      <p className="text-xs text-muted-foreground">Atende: {service.service_area}</p>
                    )}
                  </div>
                </div>
                {(provider?.city || provider?.state) && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-foreground">
                      {provider?.city}{provider?.state ? ` • ${provider.state}` : ''}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Checklist */}
        <Card>
          <CardContent className="p-4 sm:p-6 space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground">Status do seu cadastro</h2>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
              </div>
            ) : (
              <ul className="space-y-2">
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
            )}
          </CardContent>
        </Card>

        {/* CTAs principais */}
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            asChild
            size="lg"
            className="w-full hover:opacity-95 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Link to="/dashboard">
              Ir para o Dashboard <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
          {provider?.slug ? (
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full hover:bg-accent/10 focus-visible:ring-2 focus-visible:ring-primary"
            >
              <a
                href={`/profissional/${provider.slug}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver minha página pública <ExternalLink className="h-4 w-4 ml-2" />
              </a>
            </Button>
          ) : (
            <Button asChild size="lg" variant="outline" className="w-full">
              <Link to="/dashboard/perfil">Completar meu perfil</Link>
            </Button>
          )}
        </div>

        {/* Compartilhar perfil + link de afiliado */}
        {affiliateLink && (
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/10">
            <CardContent className="p-4 sm:p-5 space-y-3">
              <div className="flex items-start gap-2">
                <Share2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h2 className="font-display text-base font-bold text-foreground">Compartilhe e ganhe pontos</h2>
                  <p className="text-xs text-muted-foreground">
                    Cada pessoa que se cadastrar pelo seu link te credita pontos no ranking.
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Personalize sua mensagem antes de enviar
                  </label>
                  {shareMessage !== defaultMessage && (
                    <button
                      type="button"
                      onClick={resetMessage}
                      className="text-[10px] text-primary hover:underline"
                    >
                      restaurar padrão
                    </button>
                  )}
                </div>
                <Textarea
                  value={shareMessage}
                  onChange={(e) => setShareMessage(e.target.value.slice(0, 600))}
                  rows={3}
                  placeholder={defaultMessage}
                  className="text-xs resize-none"
                />
                <p className="text-right text-[10px] text-muted-foreground">{shareMessage.length}/600</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button onClick={handleWhatsApp} size="sm" className="w-full">
                  <Share2 className="h-4 w-4 mr-2" /> Compartilhar no WhatsApp
                </Button>
                <Button onClick={handleCopy} size="sm" variant="outline" className="w-full">
                  {copied ? <Check className="h-4 w-4 mr-2 text-emerald-600" /> : <Copy className="h-4 w-4 mr-2" />}
                  {copied ? 'Copiado!' : 'Copiar link'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instalar app (PWA) */}
        <InstallAppCard source="onboarding-v2-success" />

        {/* Próximos passos opcionais */}
        {!loading && (!hasPhotos || !hasPortfolio) && (
          <Card>
            <CardContent className="p-4 sm:p-6 space-y-3">
              <h2 className="font-display text-lg font-bold text-foreground">Próximos passos sugeridos</h2>
              <div className="grid gap-2">
                {!hasPhotos && (
                  <Button asChild variant="outline" size="sm" className="justify-start hover:bg-accent/10">
                    <Link to="/dashboard/servicos" className="flex items-center gap-2">
                      <Camera className="h-4 w-4 text-primary" />
                      <span>Adicionar fotos no seu serviço</span>
                    </Link>
                  </Button>
                )}
                {!hasPortfolio && (
                  <Button asChild variant="outline" size="sm" className="justify-start hover:bg-accent/10">
                    <Link to="/dashboard/portfolio" className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-primary" />
                      <span>Criar seu 1º álbum de portfólio</span>
                    </Link>
                  </Button>
                )}
                <Button asChild variant="outline" size="sm" className="justify-start hover:bg-accent/10">
                  <Link to="/dashboard/perfil" className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <span>Completar verificação de documento</span>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default OnboardingV2SuccessPage;
