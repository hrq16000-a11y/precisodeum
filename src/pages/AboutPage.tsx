import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { useRef } from 'react';
import {
  ArrowRight, Hammer, ShieldCheck, Eye, Users, Heart,
  Ban, Handshake, Calculator, MessageCircle, Briefcase,
  TrendingUp, GraduationCap, Award, Sparkles, Star,
  Crown, Wrench, Camera, Zap, Home, CheckCircle2,
  Rocket, Trophy, Target, ThumbsUp, Building2, BookOpen,
  Globe, Calendar, Flag, Milestone
} from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PageTransition from '@/components/PageTransition';
import { Button } from '@/components/ui/button';
import AnimatedCounter from '@/components/ui/AnimatedCounter';

/* ── animation variants ── */
const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.6 },
};

const staggerContainer = {
  initial: {},
  whileInView: { transition: { staggerChildren: 0.12 } },
  viewport: { once: true },
};

const staggerChild = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

/* ── data ── */
const philosophyPillars = [
  { icon: <Ban className="h-6 w-6" />, title: 'Não ao Leilão de Preços', description: 'Combatemos a desvalorização da mão de obra. Qualidade tem valor e defendemos o preço justo para todo profissional.', gradient: 'from-destructive/20 via-destructive/5 to-transparent' },
  { icon: <Handshake className="h-6 w-6" />, title: 'Negociação Direta', description: 'Não intermediamos nem cobramos taxas sobre seus orçamentos. O lucro é 100% seu, sempre.', gradient: 'from-accent/20 via-accent/5 to-transparent' },
  { icon: <Calculator className="h-6 w-6" />, title: 'Tabela de Referência', description: 'Oferecemos uma tabela de valores sugeridos para ajudar o profissional a cobrar com segurança e confiança.', gradient: 'from-primary/20 via-primary/5 to-transparent' },
  { icon: <MessageCircle className="h-6 w-6" />, title: 'Rede de Apoio', description: 'Grupos de WhatsApp para suporte entre colegas, troca de experiências e crescimento mútuo na profissão.', gradient: 'from-success/20 via-success/5 to-transparent' },
];

const characteristics = [
  { icon: <Briefcase className="h-7 w-7" />, title: 'Independência', description: 'Você é dono da sua agenda e do seu negócio. Sem patrão, sem horário fixo.' },
  { icon: <Eye className="h-7 w-7" />, title: 'Visibilidade', description: 'Posicionamento de destaque para quem busca qualidade profissional.' },
  { icon: <GraduationCap className="h-7 w-7" />, title: 'Comunidade', description: 'Acesso a cursos gratuitos, certificações e suporte técnico.' },
  { icon: <Award className="h-7 w-7" />, title: 'Dignidade', description: 'Portfolio profissional, avaliações e selo de destaque.' },
  { icon: <ShieldCheck className="h-7 w-7" />, title: 'Sem Taxas Ocultas', description: 'Zero comissão, zero intermediação, zero surpresas.' },
];

const steps = [
  { step: '01', icon: <Home className="h-7 w-7" />, title: 'Crie seu perfil', desc: 'Cadastro gratuito com foto, descrição e serviços. Leva menos de 5 minutos.' },
  { step: '02', icon: <Camera className="h-7 w-7" />, title: 'Monte seu portfólio', desc: 'Adicione fotos dos seus trabalhos realizados. Mostre do que você é capaz.' },
  { step: '03', icon: <Zap className="h-7 w-7" />, title: 'Receba clientes', desc: 'Clientes te encontram e entram em contato direto via WhatsApp. Sem intermediários.' },
];

const exampleProviders = [
  'Eletricista', 'Encanador', 'Pintor', 'Pedreiro', 'Marceneiro',
  'Mecânico', 'Cabeleireiro', 'Manicure', 'Costureira', 'Fotógrafo',
  'Designer Gráfico', 'Desenvolvedor Web', 'Contador', 'Advogado',
  'Professor Particular', 'Personal Trainer', 'Nutricionista',
  'Psicólogo', 'Jardineiro', 'Limpeza Profissional', 'Babá',
  'Cuidador de Idosos', 'Montador de Móveis', 'Instalador de Ar-Condicionado',
  'Serralheiro', 'Vidraceiro', 'Técnico de Informática', 'Editor de Vídeo',
  'Marketing Digital', 'Consultor Empresarial', 'Motorista Particular',
  'Entregador', 'Organizador de Eventos', 'Produtor Audiovisual',
  'Tradutor', 'Veterinário', 'Detetizador', 'Gesseiro',
  'Azulejista', 'Soldador', 'Chaveiro', 'Tapeceiro',
  'Desentupidor', 'Impermeabilizador', 'Técnico em Segurança Eletrônica',
  'Corretor de Seguros', 'Massagista', 'Recreador Infantil',
  'Passeador de Cães', 'Sapateiro',
];

const heroStats = [
  { value: 5000, label: 'Profissionais', suffix: '+', icon: <Users className="h-5 w-5" /> },
  { value: 200, label: 'Cidades', suffix: '+', icon: <Globe className="h-5 w-5" /> },
  { value: 50, label: 'Profissões', suffix: '+', icon: <Wrench className="h-5 w-5" /> },
  { value: 100, label: 'Lucro é seu', suffix: '%', icon: <TrendingUp className="h-5 w-5" /> },
];

const commitments = [
  { icon: <ThumbsUp className="h-5 w-5" />, text: 'Preço justo para quem trabalha com excelência' },
  { icon: <Target className="h-5 w-5" />, text: 'Foco total na valorização do prestador' },
  { icon: <Trophy className="h-5 w-5" />, text: 'Meritocracia: quem se dedica, ganha destaque' },
  { icon: <Rocket className="h-5 w-5" />, text: 'Ferramentas gratuitas para crescer na carreira' },
];

const timeline = [
  { year: '2024', title: 'A ideia nasceu', desc: 'Identificamos a necessidade de uma plataforma que valorizasse o profissional, sem leilão de preços.', icon: <Sparkles className="h-5 w-5" /> },
  { year: '2024', title: 'MVP lançado', desc: 'Primeira versão com cadastro de profissionais e busca por categoria no Paraná.', icon: <Rocket className="h-5 w-5" /> },
  { year: '2025', title: 'Expansão nacional', desc: 'Cobertura em todas as capitais brasileiras com mais de 50 categorias profissionais.', icon: <Globe className="h-5 w-5" /> },
  { year: '2025', title: 'Portal de cursos', desc: 'Parcerias com SEBRAE, SENAI e FGV para oferecer capacitação gratuita.', icon: <GraduationCap className="h-5 w-5" /> },
  { year: '2026', title: 'Comunidade ativa', desc: 'Mais de 5.000 profissionais ativos, grupos de apoio e sistema de gamificação.', icon: <Users className="h-5 w-5" /> },
  { year: '2026', title: 'O futuro', desc: 'App mobile, IA para matching inteligente e muito mais em desenvolvimento.', icon: <Flag className="h-5 w-5" /> },
];

const partners = [
  'SEBRAE', 'SENAI', 'FGV', 'SENAC', 'Coursera', 'Google', 'Meta', 'YouTube',
  'SEBRAE', 'SENAI', 'FGV', 'SENAC', 'Coursera', 'Google', 'Meta', 'YouTube',
];

/* ── floating particles (decorative) ── */
const FloatingParticles = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden">
    {[...Array(6)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute rounded-full bg-accent/10"
        style={{
          width: 6 + i * 4,
          height: 6 + i * 4,
          left: `${15 + i * 14}%`,
          top: `${20 + (i % 3) * 25}%`,
        }}
        animate={{
          y: [0, -30, 0],
          opacity: [0.2, 0.5, 0.2],
          scale: [1, 1.3, 1],
        }}
        transition={{ duration: 4 + i, repeat: Infinity, delay: i * 0.6 }}
      />
    ))}
  </div>
);

/* ── Hero animated visual ── */
const HeroAnimation = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden">
    {/* Pulsing rings */}
    {[0, 1, 2].map(i => (
      <motion.div
        key={`ring-${i}`}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/10"
        style={{ width: 200 + i * 200, height: 200 + i * 200 }}
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.08, 0.15, 0.08],
        }}
        transition={{ duration: 4 + i, repeat: Infinity, delay: i * 0.8 }}
      />
    ))}
    {/* Orbiting dots */}
    {[0, 1, 2, 3, 4].map(i => (
      <motion.div
        key={`orbit-${i}`}
        className="absolute left-1/2 top-1/2 w-2 h-2 rounded-full"
        style={{ background: i % 2 === 0 ? 'hsl(var(--accent))' : 'hsl(var(--secondary))' }}
        animate={{
          x: [Math.cos(i * 1.25) * 120, Math.cos(i * 1.25 + Math.PI) * 120],
          y: [Math.sin(i * 1.25) * 80, Math.sin(i * 1.25 + Math.PI) * 80],
          opacity: [0.2, 0.5, 0.2],
        }}
        transition={{ duration: 6 + i, repeat: Infinity, ease: 'linear' }}
      />
    ))}
    {/* Central glow */}
    <motion.div
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full"
      style={{ background: 'radial-gradient(circle, hsl(var(--accent) / 0.15), transparent)' }}
      animate={{ scale: [1, 1.5, 1] }}
      transition={{ duration: 3, repeat: Infinity }}
    />
  </div>
);

/* ── Partners Marquee ── */
const PartnersMarquee = () => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  return (
    <section ref={ref} className="py-16 bg-muted/20 overflow-hidden">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-10"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-accent mb-5">
            <Building2 className="h-3.5 w-3.5" /> Parceiros & Instituições
          </span>
          <h2 className="font-display text-3xl font-extrabold text-foreground md:text-4xl">
            Quem caminha conosco
          </h2>
          <p className="mt-3 max-w-2xl mx-auto text-muted-foreground text-lg">
            Parcerias com as melhores instituições do Brasil para capacitação gratuita.
          </p>
        </motion.div>
      </div>

      {/* Marquee row */}
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-background to-transparent z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-background to-transparent z-10" />
        <motion.div
          className="flex gap-6 w-max"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        >
          {partners.map((name, i) => (
            <div
              key={`${name}-${i}`}
              className="flex items-center gap-3 bg-card border border-border rounded-2xl px-8 py-5 shadow-sm shrink-0 hover:border-accent/30 hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-accent" />
              </div>
              <span className="text-base font-bold text-foreground whitespace-nowrap">{name}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

/* ── Timeline ── */
const TimelineSection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section ref={ref} className="py-20 md:py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] via-transparent to-accent/[0.02]" />
      <div className="container relative max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-14"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-accent mb-5">
            <Calendar className="h-3.5 w-3.5" /> Nossa Jornada
          </span>
          <h2 className="font-display text-3xl font-extrabold text-foreground md:text-4xl">
            De uma ideia a um movimento
          </h2>
        </motion.div>

        {/* Timeline line */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-accent/40 via-accent/20 to-transparent md:-translate-x-px" />

          {timeline.map((item, i) => {
            const isLeft = i % 2 === 0;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, x: isLeft ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className={`relative flex items-start mb-10 ${
                  isLeft ? 'md:flex-row' : 'md:flex-row-reverse'
                } flex-row`}
              >
                {/* Dot on line */}
                <div className="absolute left-6 md:left-1/2 -translate-x-1/2 z-10">
                  <motion.div
                    whileInView={{ scale: [0, 1.2, 1] }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 + 0.2 }}
                    className="w-12 h-12 rounded-full bg-card border-2 border-accent/40 flex items-center justify-center shadow-lg shadow-accent/10"
                  >
                    <span className="text-accent">{item.icon}</span>
                  </motion.div>
                </div>

                {/* Content card */}
                <div className={`ml-20 md:ml-0 md:w-[calc(50%-2rem)] ${isLeft ? 'md:pr-8 md:text-right' : 'md:pl-8 md:ml-auto'}`}>
                  <motion.div
                    whileHover={{ y: -4 }}
                    className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-accent/30 transition-all"
                  >
                    <span className="text-xs font-bold text-accent bg-accent/10 rounded-full px-3 py-1">{item.year}</span>
                    <h3 className="font-display text-base font-bold text-foreground mt-3 mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </motion.div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

const AboutPage = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <PageTransition>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />

        {/* ═══════ HERO — Manifesto ═══════ */}
        <section ref={heroRef} className="relative bg-hero py-24 md:py-32 overflow-hidden">
          <FloatingParticles />
          <HeroAnimation />

          {/* Decorative shapes */}
          <div className="absolute top-8 left-8 opacity-[0.06]">
            <Hammer className="h-24 w-24 text-primary-foreground" />
          </div>
          <div className="absolute bottom-8 right-8 opacity-[0.06]">
            <Crown className="h-20 w-20 text-primary-foreground" />
          </div>

          {/* Animated glow orbs */}
          <motion.div
            className="absolute top-1/3 left-1/4 w-80 h-80 bg-accent/8 rounded-full blur-[100px]"
            animate={{ scale: [1, 1.4, 1], opacity: [0.08, 0.15, 0.08] }}
            transition={{ duration: 8, repeat: Infinity }}
          />
          <motion.div
            className="absolute bottom-1/4 right-1/3 w-60 h-60 bg-primary-foreground/5 rounded-full blur-[80px]"
            animate={{ scale: [1.2, 1, 1.2], opacity: [0.05, 0.1, 0.05] }}
            transition={{ duration: 6, repeat: Infinity, delay: 2 }}
          />

          <motion.div style={{ y: heroY, opacity: heroOpacity }} className="container relative z-10 text-center">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 backdrop-blur-md border border-primary-foreground/15 px-5 py-2.5 mb-8"
            >
              <Heart className="h-4 w-4 text-accent animate-pulse" />
              <span className="text-sm font-semibold text-primary-foreground/90 tracking-wider uppercase">Manifesto de Valorização</span>
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
              className="font-display text-3xl font-extrabold tracking-tight text-primary-foreground md:text-5xl lg:text-6xl leading-[1.1]"
            >
              Mais que uma plataforma,
              <br />
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-accent via-amber-400 to-accent bg-clip-text text-transparent">
                  um movimento de valorização
                </span>
                <motion.span
                  className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-accent/0 via-accent to-accent/0 rounded-full"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.8, duration: 0.6 }}
                />
              </span>
              <br />
              do profissional.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mx-auto mt-8 max-w-3xl text-lg md:text-xl text-primary-foreground/70 leading-relaxed"
            >
              Unimos quem precisa de soluções a profissionais que entregam excelência, com{' '}
              <strong className="text-primary-foreground font-semibold">dignidade, preço justo</strong> e sem leilão de mão de obra.
            </motion.p>

            {/* Animated Stats bar */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="mt-12 flex flex-wrap justify-center gap-3 md:gap-6"
            >
              {heroStats.map((stat) => (
                <motion.div
                  key={stat.label}
                  whileHover={{ scale: 1.05, y: -3 }}
                  className="flex items-center gap-3 bg-primary-foreground/5 backdrop-blur-md border border-primary-foreground/10 rounded-2xl px-6 py-4 transition-all"
                >
                  <span className="text-accent">{stat.icon}</span>
                  <div className="text-left">
                    <AnimatedCounter
                      value={stat.value}
                      suffix={stat.suffix}
                      duration={1800}
                      className="block text-2xl font-extrabold text-primary-foreground"
                    />
                    <span className="text-[11px] uppercase tracking-wider text-primary-foreground/50 font-medium">{stat.label}</span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* Bottom wave separator */}
          <div className="absolute bottom-0 left-0 right-0">
            <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
              <path d="M0 60L48 52C96 44 192 28 288 22C384 16 480 20 576 28C672 36 768 48 864 48C960 48 1056 36 1152 28C1248 20 1344 16 1392 14L1440 12V60H0Z" fill="hsl(var(--background))" />
            </svg>
          </div>
        </section>

        {/* ═══════ Commitments ribbon ═══════ */}
        <section className="py-6 border-b border-border bg-card">
          <div className="container">
            <motion.div {...fadeUp} className="flex flex-wrap justify-center gap-x-8 gap-y-3">
              {commitments.map((c) => (
                <div key={c.text} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="text-accent">{c.icon}</span>
                  <span>{c.text}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ═══════ Philosophy ═══════ */}
        <section className="py-20 md:py-24">
          <div className="container">
            <motion.div {...fadeUp} className="text-center mb-14">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-accent mb-5">
                <Sparkles className="h-3.5 w-3.5" /> Nossa Filosofia
              </span>
              <h2 className="font-display text-3xl font-extrabold text-foreground md:text-4xl lg:text-5xl">
                Trabalho Digno e Respeito
              </h2>
              <p className="mt-4 max-w-2xl mx-auto text-muted-foreground text-lg">
                Acreditamos que todo profissional merece reconhecimento, respeito e remuneração justa.
              </p>
            </motion.div>

            <motion.div {...staggerContainer} className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {philosophyPillars.map((pillar) => (
                <motion.div
                  key={pillar.title}
                  {...staggerChild}
                  whileHover={{ y: -8, scale: 1.02 }}
                  className="group relative rounded-3xl border border-border bg-card p-7 shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-all duration-400 overflow-hidden"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${pillar.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-accent/30 group-hover:bg-accent group-hover:shadow-[var(--glow-orange)] transition-all duration-300" />
                  <div className="relative">
                    <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent group-hover:bg-accent group-hover:text-accent-foreground transition-all duration-300 group-hover:shadow-lg group-hover:shadow-accent/20">
                      {pillar.icon}
                    </div>
                    <h3 className="font-display text-lg font-bold text-foreground mb-2">{pillar.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{pillar.description}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ═══════ Quote / Manifesto ═══════ */}
        <section className="relative py-16 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-accent/[0.02] to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--accent)/0.06),transparent_70%)]" />

          <div className="container relative max-w-4xl">
            <motion.blockquote {...fadeUp} className="relative text-center px-8">
              <motion.div
                className="absolute -top-6 left-1/2 -translate-x-1/2 text-accent/15 text-8xl font-serif select-none"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                "
              </motion.div>
              <p className="text-xl md:text-2xl lg:text-3xl font-medium text-foreground leading-relaxed italic pt-6">
                Não somos um leilão de mão de obra. Somos uma vitrine de excelência, onde o profissional é o protagonista e o{' '}
                <span className="text-accent font-bold not-italic">preço justo</span> é a regra.
              </p>
              <footer className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <span className="h-px w-8 bg-accent/40" />
                Equipe <span className="text-accent font-bold">Preciso de Um</span>
                <span className="h-px w-8 bg-accent/40" />
              </footer>
            </motion.blockquote>
          </div>
        </section>

        {/* ═══════ Timeline ═══════ */}
        <TimelineSection />

        {/* ═══════ 5 Values ═══════ */}
        <section className="py-20 md:py-24 bg-muted/30">
          <div className="container">
            <motion.div {...fadeUp} className="mb-14 text-center">
              <h2 className="font-display text-3xl font-extrabold text-foreground md:text-4xl">
                O que você ganha sendo parte da nossa rede
              </h2>
              <p className="mt-4 max-w-2xl mx-auto text-muted-foreground text-lg">
                Construímos ferramentas para que você se concentre no que faz de melhor.
              </p>
            </motion.div>

            <motion.div {...staggerContainer} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
              {characteristics.map((item) => (
                <motion.div
                  key={item.title}
                  {...staggerChild}
                  whileHover={{ y: -6, scale: 1.03 }}
                  className="group relative rounded-2xl border border-border bg-card p-6 shadow-[var(--card-shadow)] text-center hover:shadow-[var(--card-shadow-hover)] hover:border-accent/30 transition-all duration-300 overflow-hidden"
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[linear-gradient(105deg,transparent_40%,hsl(var(--accent)/0.04)_45%,hsl(var(--accent)/0.08)_50%,hsl(var(--accent)/0.04)_55%,transparent_60%)]" />
                  <div className="relative">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent group-hover:bg-accent group-hover:text-accent-foreground transition-all duration-300 group-hover:shadow-lg group-hover:shadow-accent/20">
                      {item.icon}
                    </div>
                    <h3 className="font-display text-sm font-bold text-foreground mb-2">{item.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ═══════ Partners Marquee ═══════ */}
        <PartnersMarquee />

        {/* ═══════ How it works ═══════ */}
        <section className="py-20 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

          <div className="container relative max-w-5xl">
            <motion.div {...fadeUp} className="text-center mb-14">
              <h2 className="font-display text-3xl font-extrabold text-foreground md:text-4xl">
                Como funciona para o profissional
              </h2>
            </motion.div>

            <div className="grid gap-8 md:grid-cols-3">
              {steps.map((item, i) => (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.2, duration: 0.6, ease: "easeOut" }}
                  whileHover={{ y: -6 }}
                  className="relative rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-all duration-300"
                >
                  <motion.span
                    className="absolute -top-4 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground text-xs font-extrabold px-5 py-1.5 rounded-full shadow-lg shadow-accent/25"
                    whileHover={{ scale: 1.1 }}
                  >
                    {item.step}
                  </motion.span>
                  {i < 2 && (
                    <div className="hidden md:block absolute top-1/2 -right-4 w-8 border-t-2 border-dashed border-accent/30" />
                  )}
                  <div className="mx-auto mt-4 mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/15 to-accent/5 text-accent">
                    {item.icon}
                  </div>
                  <h3 className="font-display text-base font-bold text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  <div className="mt-4 flex justify-center">
                    <CheckCircle2 className="h-5 w-5 text-accent/40" />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════ 50 Professions ═══════ */}
        <section className="py-20 bg-muted/20">
          <div className="container">
            <motion.div {...fadeUp} className="mb-10 text-center">
              <h2 className="font-display text-3xl font-extrabold text-foreground md:text-4xl">
                Profissões que valorizamos
              </h2>
              <p className="mt-3 max-w-2xl mx-auto text-muted-foreground text-lg">
                De eletricistas a designers — todo profissional merece destaque.
              </p>
            </motion.div>

            <motion.div {...fadeUp} className="flex flex-wrap justify-center gap-2.5">
              {exampleProviders.map((name, i) => (
                <motion.span
                  key={name}
                  initial={{ opacity: 0, scale: 0.85 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.012, duration: 0.3 }}
                  whileHover={{ scale: 1.08, y: -2 }}
                  className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground shadow-sm hover:border-accent/40 hover:bg-accent/5 hover:shadow-md transition-all cursor-default"
                >
                  {name}
                </motion.span>
              ))}
            </motion.div>

            <motion.p
              {...fadeUp}
              className="mt-10 text-center text-muted-foreground max-w-3xl mx-auto leading-relaxed text-lg"
            >
              Sempre que alguém procurar por{' '}
              <strong className="text-foreground">"preciso de um profissional"</strong>, nosso objetivo é que eles encontrem{' '}
              <strong className="text-accent font-bold">você</strong> através do nosso ecossistema em{' '}
              <a href="https://www.precisodeum.com.br" className="text-accent font-bold hover:underline underline-offset-4" target="_blank" rel="noopener noreferrer">
                www.precisodeum.com.br
              </a>.
            </motion.p>
          </div>
        </section>

        {/* ═══════ Final CTA ═══════ */}
        <section className="relative bg-hero py-24 md:py-28 overflow-hidden">
          <motion.div
            className="absolute top-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-[120px]"
            animate={{ scale: [1, 1.4, 1], x: [0, 30, 0] }}
            transition={{ duration: 7, repeat: Infinity }}
          />
          <motion.div
            className="absolute bottom-0 left-0 w-72 h-72 bg-primary-foreground/5 rounded-full blur-[100px]"
            animate={{ scale: [1.2, 1, 1.2] }}
            transition={{ duration: 5, repeat: Infinity, delay: 1 }}
          />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, hsl(var(--primary-foreground)) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

          <div className="container relative z-10 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="space-y-8"
            >
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity }}
              >
                <Star className="h-12 w-12 text-accent mx-auto drop-shadow-[0_0_20px_hsl(var(--accent)/0.4)]" />
              </motion.div>

              <h2 className="font-display text-3xl font-extrabold text-primary-foreground md:text-4xl lg:text-5xl leading-tight">
                Seu talento merece ser visto.
                <br />
                <span className="bg-gradient-to-r from-accent via-amber-400 to-accent bg-clip-text text-transparent">
                  Sua profissão merece respeito.
                </span>
              </h2>

              <p className="mx-auto max-w-lg text-primary-foreground/70 text-lg">
                Junte-se a milhares de profissionais que estão transformando suas carreiras com a{' '}
                <strong className="text-primary-foreground">Preciso de Um</strong>.
              </p>

              <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center pt-4">
                <Button variant="hero" size="xl" className="rounded-full shadow-xl shadow-accent/25 hover:shadow-accent/40 transition-shadow" asChild>
                  <Link to="/cadastro">
                    Quero me valorizar no mercado <ArrowRight className="h-5 w-5 ml-1" />
                  </Link>
                </Button>
                <Button variant="outline" size="xl" className="rounded-full border-accent/50 text-accent font-semibold hover:bg-accent/10 hover:border-accent backdrop-blur-sm" asChild>
                  <Link to="/buscar">Buscar Profissional</Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        <Footer />
      </div>
    </PageTransition>
  );
};

export default AboutPage;
