import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, Hammer, ShieldCheck, Eye, Users, Heart,
  Ban, Handshake, Calculator, MessageCircle, Briefcase,
  TrendingUp, GraduationCap, Award, Sparkles, Star,
  Crown, Wrench, Camera, Zap, Home
} from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PageTransition from '@/components/PageTransition';
import ParallaxSection from '@/components/ParallaxSection';
import { Button } from '@/components/ui/button';

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

const philosophyPillars = [
  {
    icon: <Ban className="h-6 w-6" />,
    title: 'Não ao Leilão de Preços',
    description: 'Combatemos a desvalorização da mão de obra. Qualidade tem valor e defendemos o preço justo para todo profissional.',
    accent: 'from-destructive/20 to-destructive/5',
  },
  {
    icon: <Handshake className="h-6 w-6" />,
    title: 'Negociação Direta',
    description: 'Não intermediamos nem cobramos taxas sobre seus orçamentos. O lucro é 100% seu, sempre.',
    accent: 'from-accent/20 to-accent/5',
  },
  {
    icon: <Calculator className="h-6 w-6" />,
    title: 'Tabela de Referência',
    description: 'Oferecemos uma tabela de valores sugeridos para ajudar o profissional a cobrar com segurança e confiança.',
    accent: 'from-primary/20 to-primary/5',
  },
  {
    icon: <MessageCircle className="h-6 w-6" />,
    title: 'Rede de Apoio',
    description: 'Grupos de WhatsApp para suporte entre colegas, troca de experiências e crescimento mútuo na profissão.',
    accent: 'from-success/20 to-success/5',
  },
];

const characteristics = [
  {
    icon: <Briefcase className="h-6 w-6" />,
    title: 'Independência',
    description: 'Você é dono da sua agenda e do seu negócio. Sem patrão, sem horário fixo — você decide como e quando trabalhar.',
  },
  {
    icon: <Eye className="h-6 w-6" />,
    title: 'Visibilidade',
    description: 'Posicionamento de destaque para quem busca qualidade. Seu perfil é visto por quem realmente precisa do seu trabalho.',
  },
  {
    icon: <GraduationCap className="h-6 w-6" />,
    title: 'Comunidade',
    description: 'Acesso a cursos gratuitos, certificações e suporte técnico para evoluir constantemente na sua carreira.',
  },
  {
    icon: <Award className="h-6 w-6" />,
    title: 'Dignidade',
    description: 'Ferramentas para ser visto como um especialista. Portfolio profissional, avaliações e selo de destaque.',
  },
  {
    icon: <ShieldCheck className="h-6 w-6" />,
    title: 'Sem Taxas Ocultas',
    description: 'Tudo o que você combina com o cliente é seu. Zero comissão, zero intermediação, zero surpresas.',
  },
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

const stats = [
  { value: '100%', label: 'Lucro é seu', icon: <TrendingUp className="h-5 w-5" /> },
  { value: '0%', label: 'De taxas', icon: <ShieldCheck className="h-5 w-5" /> },
  { value: '50+', label: 'Profissões', icon: <Wrench className="h-5 w-5" /> },
  { value: '24/7', label: 'Visibilidade', icon: <Eye className="h-5 w-5" /> },
];

const AboutPage = () => {
  return (
    <PageTransition>
    <div className="flex min-h-screen flex-col">
      <Header />

      {/* Hero — Manifesto */}
      <section className="relative bg-hero py-20 md:py-28 overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-10 left-10 opacity-10">
          <Hammer className="h-20 w-20 text-primary-foreground" />
        </div>
        <div className="absolute bottom-10 right-10 opacity-10">
          <Crown className="h-16 w-16 text-primary-foreground" />
        </div>
        <motion.div
          className="absolute top-1/2 left-1/4 w-64 h-64 bg-accent/10 rounded-full blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 6, repeat: Infinity }}
        />

        <div className="container relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 px-4 py-2 mb-6"
          >
            <Heart className="h-4 w-4 text-accent" />
            <span className="text-sm font-semibold text-primary-foreground/90 tracking-wide">Manifesto de Valorização</span>
          </motion.div>

          <motion.h1
            {...fadeIn}
            className="font-display text-3xl font-extrabold tracking-tight text-primary-foreground md:text-5xl lg:text-6xl leading-tight"
          >
            Mais que uma plataforma,
            <br />
            <span className="bg-gradient-to-r from-accent to-amber-300 bg-clip-text text-transparent">
              um movimento de valorização
            </span>
            <br />
            do profissional.
          </motion.h1>
          <motion.p
            {...fadeIn}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mx-auto mt-6 max-w-3xl text-lg md:text-xl text-primary-foreground/70 leading-relaxed"
          >
            Unimos quem precisa de soluções a profissionais que entregam excelência, com <strong className="text-primary-foreground">dignidade, preço justo</strong> e sem leilão de mão de obra.
          </motion.p>

          {/* Stats bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="mt-10 flex flex-wrap justify-center gap-4 md:gap-8"
          >
            {stats.map((stat) => (
              <div key={stat.label} className="flex items-center gap-2.5 bg-primary-foreground/5 backdrop-blur-sm border border-primary-foreground/10 rounded-xl px-5 py-3">
                <span className="text-accent">{stat.icon}</span>
                <div className="text-left">
                  <span className="block text-xl font-bold text-primary-foreground">{stat.value}</span>
                  <span className="text-[11px] text-primary-foreground/60">{stat.label}</span>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Philosophy — Trabalho Digno */}
      <section className="py-16 md:py-20">
        <div className="container">
          <motion.div {...fadeIn} className="text-center mb-12">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent mb-4">
              <Sparkles className="h-3 w-3" /> Nossa Filosofia
            </span>
            <h2 className="font-display text-2xl font-bold text-foreground md:text-4xl">
              Trabalho Digno e Respeito
            </h2>
            <p className="mt-3 max-w-2xl mx-auto text-muted-foreground">
              Acreditamos que todo profissional merece reconhecimento, respeito e remuneração justa. Esses são os pilares que guiam tudo o que fazemos.
            </p>
          </motion.div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {philosophyPillars.map((pillar, i) => (
              <motion.div
                key={pillar.title}
                initial={{ opacity: 0, y: 24, scale: 0.96 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.1 }}
                whileHover={{ y: -6 }}
                className="group relative rounded-2xl border border-border bg-card p-6 shadow-card hover:shadow-xl transition-all duration-300 overflow-hidden"
              >
                {/* Gradient bg */}
                <div className={`absolute inset-0 bg-gradient-to-br ${pillar.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

                <div className="relative">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent group-hover:bg-accent group-hover:text-accent-foreground transition-colors duration-300">
                    {pillar.icon}
                  </div>
                  <h3 className="font-display text-base font-bold text-foreground mb-2">{pillar.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{pillar.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Quote / Manifesto block */}
      <section className="bg-muted/50 py-12">
        <div className="container max-w-4xl">
          <motion.blockquote
            {...fadeIn}
            className="relative text-center px-6"
          >
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-accent/20 text-6xl font-serif">"</div>
            <p className="text-xl md:text-2xl font-medium text-foreground leading-relaxed italic">
              Não somos um leilão de mão de obra. Somos uma vitrine de excelência, onde o profissional é o protagonista e o preço justo é a regra.
            </p>
            <footer className="mt-4 text-sm text-muted-foreground">
              — Equipe <span className="text-accent font-semibold">Preciso de Um</span>
            </footer>
          </motion.blockquote>
        </div>
      </section>

      {/* 5 Characteristics / Values */}
      <ParallaxSection speed={0.12} orb orbColor="primary" className="py-16 md:py-20">
        <div className="container">
          <motion.div {...fadeIn} className="mb-10 text-center">
            <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">
              O que você ganha sendo parte da nossa rede
            </h2>
            <p className="mt-2 max-w-2xl mx-auto text-muted-foreground">
              Construímos ferramentas para que você se concentre no que faz de melhor: entregar um trabalho excelente.
            </p>
          </motion.div>
          <div className="grid gap-4 md:grid-cols-5">
            {characteristics.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                whileHover={{ y: -4, scale: 1.02 }}
                className="group rounded-xl border border-border bg-card p-5 shadow-card text-center hover:shadow-xl hover:border-accent/30 transition-all duration-300"
              >
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent group-hover:bg-accent group-hover:text-accent-foreground transition-colors duration-300">
                  {item.icon}
                </div>
                <h3 className="font-display text-sm font-bold text-foreground">{item.title}</h3>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </ParallaxSection>

      {/* How it works visual */}
      <section className="py-16 bg-muted/30">
        <div className="container max-w-4xl">
          <motion.div {...fadeIn} className="text-center mb-10">
            <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">
              Como funciona para o profissional
            </h2>
          </motion.div>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { step: '01', icon: <Home className="h-6 w-6" />, title: 'Crie seu perfil', desc: 'Cadastro gratuito com foto, descrição e serviços. Leva menos de 5 minutos.' },
              { step: '02', icon: <Camera className="h-6 w-6" />, title: 'Monte seu portfólio', desc: 'Adicione fotos dos seus trabalhos realizados. Mostre do que você é capaz.' },
              { step: '03', icon: <Zap className="h-6 w-6" />, title: 'Receba clientes', desc: 'Clientes te encontram e entram em contato direto via WhatsApp. Sem intermediários.' },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.45 }}
                className="relative rounded-2xl border border-border bg-card p-6 text-center"
              >
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground text-xs font-bold px-3 py-1 rounded-full">
                  {item.step}
                </span>
                <div className="mx-auto mt-2 mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  {item.icon}
                </div>
                <h3 className="font-display text-sm font-bold text-foreground">{item.title}</h3>
                <p className="mt-2 text-xs text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 50 Examples */}
      <section className="py-16">
        <div className="container">
          <motion.div {...fadeIn} className="mb-8 text-center">
            <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">
              Profissões que valorizamos
            </h2>
            <p className="mt-2 max-w-2xl mx-auto text-muted-foreground">
              De eletricistas a designers, de encanadores a consultores — todo profissional merece destaque.
            </p>
          </motion.div>
          <div className="flex flex-wrap justify-center gap-2">
            {exampleProviders.map((name, i) => (
              <motion.span
                key={name}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.015, duration: 0.3 }}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground shadow-sm hover:border-accent/30 hover:bg-accent/5 transition-colors cursor-default"
              >
                {name}
              </motion.span>
            ))}
          </div>
          <motion.p
            {...fadeIn}
            className="mt-8 text-center text-muted-foreground max-w-3xl mx-auto leading-relaxed"
          >
            Sempre que alguém procurar por <strong className="text-foreground">"preciso de um profissional"</strong>, nosso objetivo é que eles encontrem <strong className="text-accent">você</strong> através do nosso ecossistema em{' '}
            <a href="https://www.precisodeum.com.br" className="text-accent font-semibold hover:underline" target="_blank" rel="noopener noreferrer">
              www.precisodeum.com.br
            </a>.
          </motion.p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative bg-hero py-20 overflow-hidden">
        <motion.div
          className="absolute top-0 right-0 w-72 h-72 bg-accent/15 rounded-full blur-3xl"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 5, repeat: Infinity }}
        />
        <div className="container relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            <Star className="h-10 w-10 text-accent mx-auto" />
            <h2 className="font-display text-2xl font-bold text-primary-foreground md:text-4xl">
              Seu talento merece ser visto.
              <br />
              <span className="bg-gradient-to-r from-accent to-amber-300 bg-clip-text text-transparent">
                Sua profissão merece respeito.
              </span>
            </h2>
            <p className="mx-auto max-w-lg text-primary-foreground/70">
              Junte-se a milhares de profissionais que estão transformando suas carreiras com a <strong className="text-primary-foreground">Preciso de Um</strong>.
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center pt-2">
              <Button variant="hero" size="xl" className="rounded-full shadow-lg shadow-accent/20" asChild>
                <Link to="/cadastro">Quero me valorizar no mercado <ArrowRight className="h-5 w-5" /></Link>
              </Button>
              <Button variant="outline" size="xl" className="rounded-full border-accent/50 text-accent font-semibold hover:bg-accent/10 hover:border-accent" asChild>
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
