import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search, GitCompareArrows, Handshake,
  UserPlus, BellRing, TrendingUp,
  BadgeCheck, Star, MapPin, MessageCircle, HeadphonesIcon, Ban,
  ChevronDown, Sparkles, Heart
} from 'lucide-react';
import OurStoryBanner from '@/components/OurStoryBanner';
import { Button } from '@/components/ui/button';
import FadeInSection from '@/components/FadeInSection';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

/* ─── Step Card ─── */
const StepCard = ({
  icon: Icon, step, title, description, color, delay,
}: {
  icon: React.ElementType; step: number; title: string; description: string;
  color: 'primary' | 'accent' | 'green'; delay: number;
}) => {
  const gradients: Record<string, string> = {
    primary: 'from-primary/15 to-primary/5 ring-primary/20',
    accent: 'from-accent/15 to-accent/5 ring-accent/20',
    green: 'from-emerald-500/15 to-emerald-500/5 ring-emerald-500/20',
  };
  const badge: Record<string, string> = {
    primary: 'bg-primary text-primary-foreground',
    accent: 'bg-accent text-accent-foreground',
    green: 'bg-emerald-600 text-white',
  };

  return (
    <FadeInSection delay={delay} className="relative text-center">
      <motion.div
        whileHover={{ scale: 1.05, y: -4 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="group relative mx-auto"
      >
        <div className={`relative mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br ${gradients[color]} shadow-sm ring-1 transition-all duration-300 group-hover:shadow-md`}>
          <Icon className="h-9 w-9 text-foreground/80" />
          <motion.span
            className={`absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shadow-md ring-2 ring-background ${badge[color]}`}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.3 + delay }}
          >
            {step}
          </motion.span>
        </div>
      </motion.div>
      <h3 className="mt-5 font-display text-lg font-bold text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">{description}</p>
    </FadeInSection>
  );
};

/* ─── Differentials Card ─── */
const DiffCard = ({ icon: Icon, title, desc, delay }: {
  icon: React.ElementType; title: string; desc: string; delay: number;
}) => (
  <FadeInSection delay={delay} scale>
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      className="glass rounded-2xl border border-border p-5 shadow-card text-center h-full"
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-3">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h4 className="font-semibold text-foreground">{title}</h4>
      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{desc}</p>
    </motion.div>
  </FadeInSection>
);

/* ─── Connecting Line ─── */
const ConnectingLine = () => (
  <div className="absolute top-10 left-[16.67%] right-[16.67%] hidden h-0.5 md:block overflow-hidden">
    <motion.div
      className="h-full bg-gradient-to-r from-primary/20 via-accent/40 to-primary/20 rounded-full origin-left"
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 1.2, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
    />
  </div>
);

/* ─── FAQ Item ─── */
const FaqItem = ({ q, a }: { q: string; a: string }) => {
  return (
    <details className="group rounded-xl border border-border bg-card p-4 [&_summary]:cursor-pointer">
      <summary className="flex items-center justify-between font-medium text-foreground">
        {q}
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{a}</p>
    </details>
  );
};

/* ─── MAIN PAGE ─── */
const ComoFuncionaPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden py-16 md:py-24">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container relative text-center">
          <FadeInSection>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary mb-4">
              <Sparkles className="h-3.5 w-3.5" /> Guia da Plataforma
            </span>
            <h1 className="font-display text-3xl font-bold text-foreground md:text-5xl leading-tight">
              Como funciona o <br className="hidden sm:block" />
              <span className="text-primary">Preciso de um</span>?
            </h1>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto text-base md:text-lg">
              Conectamos você ao profissional ideal da sua região — de forma simples, segura e <strong className="text-foreground">100% gratuita</strong> para quem busca.
            </p>
          </FadeInSection>
        </div>
      </section>

      {/* ═══ PARA CLIENTES ═══ */}
      <section className="py-14 bg-muted/30">
        <div className="container">
          <FadeInSection className="mb-10 text-center">
            <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary mb-2">
              Para quem busca
            </span>
            <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">Encontre o profissional certo</h2>
            <p className="mt-2 text-muted-foreground">Em 3 passos simples</p>
          </FadeInSection>

          <div className="relative grid gap-8 md:grid-cols-3">
            <ConnectingLine />
            <StepCard icon={Search} step={1} title="Busque" description="Digite o serviço que precisa e sua localização. Nossa busca inteligente mostra os profissionais mais próximos." color="primary" delay={0} />
            <StepCard icon={GitCompareArrows} step={2} title="Compare" description="Veja avaliações, portfólio, tempo de resposta e experiência de cada profissional antes de escolher." color="primary" delay={0.15} />
            <StepCard icon={Handshake} step={3} title="Contrate" description="Entre em contato direto pelo WhatsApp ou chat. Sem intermediários, sem taxas — você negocia direto." color="primary" delay={0.3} />
          </div>
        </div>
      </section>

      {/* ═══ PARA PROFISSIONAIS ═══ */}
      <section className="py-14">
        <div className="container">
          <FadeInSection className="mb-10 text-center">
            <span className="inline-block rounded-full bg-accent/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-accent-foreground mb-2">
              Para profissionais
            </span>
            <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">Cresça com a plataforma</h2>
            <p className="mt-2 text-muted-foreground">Cadastre-se e comece a receber clientes</p>
          </FadeInSection>

          <div className="relative grid gap-8 md:grid-cols-3">
            <ConnectingLine />
            <StepCard icon={UserPlus} step={1} title="Cadastre-se" description="Crie seu perfil profissional gratuito em poucos minutos. Adicione seus serviços, fotos e região de atendimento." color="accent" delay={0} />
            <StepCard icon={BellRing} step={2} title="Receba leads" description="Clientes da sua região encontram seu perfil e entram em contato diretamente com você." color="accent" delay={0.15} />
            <StepCard icon={TrendingUp} step={3} title="Cresça" description="Conquiste avaliações, suba no ranking e aumente sua visibilidade. Quanto mais completo o perfil, mais clientes." color="accent" delay={0.3} />
          </div>
        </div>
      </section>

      {/* ═══ É GRATUITO ═══ */}
      <section className="py-14 bg-gradient-to-br from-emerald-500/5 via-transparent to-emerald-600/5">
        <div className="container">
          <FadeInSection className="text-center max-w-2xl mx-auto">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
              <Heart className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">É Gratuito!</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Para clientes</strong>: buscar, comparar e entrar em contato com profissionais é <strong className="text-emerald-600">100% gratuito</strong>, sem nenhuma taxa ou assinatura.
            </p>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Para profissionais</strong>: o cadastro e o plano básico são gratuitos. Você só investe se quiser maior destaque com planos premium — mas começar não custa nada.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {['Sem taxas de intermediação', 'Sem mensalidade obrigatória', 'Contato direto'].map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <Ban className="h-3 w-3" /> {t}
                </span>
              ))}
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ═══ DIFERENCIAIS ═══ */}
      <section className="py-14">
        <div className="container">
          <FadeInSection className="mb-10 text-center">
            <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">Por que usar o Preciso de um?</h2>
            <p className="mt-2 text-muted-foreground">Diferenciais que fazem a diferença</p>
          </FadeInSection>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DiffCard icon={BadgeCheck} title="Perfis Verificados" desc="Profissionais com dados confirmados para mais segurança na contratação." delay={0} />
            <DiffCard icon={Star} title="Avaliações Reais" desc="Veja notas e comentários de clientes que já contrataram o serviço." delay={0.08} />
            <DiffCard icon={MapPin} title="Geolocalização" desc="Encontre profissionais próximos a você com busca por GPS e cidade." delay={0.16} />
            <DiffCard icon={Handshake} title="Sem Intermediários" desc="Negocie preço, prazo e detalhes diretamente com o profissional." delay={0.24} />
            <DiffCard icon={MessageCircle} title="Chat Direto" desc="Converse com profissionais pela plataforma antes de contratar." delay={0.32} />
            <DiffCard icon={HeadphonesIcon} title="Suporte" desc="Equipe pronta para ajudar em caso de dúvidas ou problemas." delay={0.4} />
          </div>
        </div>
      </section>

      {/* ═══ FAQ RÁPIDO ═══ */}
      <section className="py-14 bg-muted/30">
        <div className="container max-w-2xl">
          <FadeInSection className="mb-8 text-center">
            <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">Perguntas frequentes</h2>
          </FadeInSection>

          <div className="space-y-3">
            <FaqItem q="Preciso pagar para buscar profissionais?" a="Não! A busca e o contato com profissionais é 100% gratuita para clientes. Você não paga nada para usar a plataforma." />
            <FaqItem q="Como me cadastro como profissional?" a="Clique em 'Cadastrar' no topo da página, escolha o perfil 'Profissional' e preencha seus dados. Em poucos minutos seu perfil estará no ar." />
            <FaqItem q="Preciso pagar alguma mensalidade?" a="Não. O plano básico é gratuito. Existem planos premium opcionais para quem deseja mais destaque e recursos, mas não são obrigatórios." />
            <FaqItem q="Como funciona o contato com o profissional?" a="Você pode entrar em contato pelo WhatsApp ou chat da plataforma. A negociação é feita diretamente entre você e o profissional." />
            <FaqItem q="A plataforma cobra comissão sobre os serviços?" a="Não cobramos nenhuma comissão ou taxa sobre os serviços contratados. O valor é combinado diretamente entre cliente e profissional." />
          </div>
        </div>
      </section>

      {/* ═══ NOSSA HISTÓRIA ═══ */}
      <OurStoryBanner variant="full" />

      {/* ═══ CTA FINAL ═══ */}
      <section className="py-16">
        <div className="container text-center">
          <FadeInSection>
            <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">Pronto para começar?</h2>
            <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
              Seja para encontrar um profissional ou para oferecer seus serviços, estamos aqui para conectar vocês.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild variant="hero" size="lg">
                <Link to="/buscar">Buscar Profissional</Link>
              </Button>
              <Button asChild variant="hero-outline" size="lg">
                <Link to="/cadastro">Cadastrar como Profissional</Link>
              </Button>
            </div>
          </FadeInSection>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default ComoFuncionaPage;
