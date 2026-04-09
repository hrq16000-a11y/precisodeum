import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { POSITION_CONFIG, type PositionEntry } from '@/config/sponsorPositions';
import { useSponsorsBySlot, useSponsorSlotLimits } from '@/hooks/useSponsors';
import {
  ArrowRight, Info, Eye, BarChart3, Zap, Crown, Shield,
  TrendingUp, Clock, RotateCw, CheckCircle2, Sparkles
} from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: 'easeOut' as const },
  }),
};

interface SlotCard {
  key: string;
  config: PositionEntry;
  price: string;
  period: string;
  minDuration: string;
  rotation: string;
  extras: string[];
  tier: 'basic' | 'pro' | 'premium';
}

const slotData: SlotCard[] = [
  {
    key: 'hero-top',
    config: POSITION_CONFIG['hero-top'],
    price: 'R$ 799',
    period: '/mês',
    minDuration: '30 dias',
    rotation: 'A cada 10s entre até 3 banners',
    extras: ['Prioridade máxima no ranking', 'Relatórios diários de impressões', 'Posição fixa no topo'],
    tier: 'premium',
  },
  {
    key: 'featured',
    config: POSITION_CONFIG['featured'],
    price: 'R$ 599',
    period: '/mês',
    minDuration: '30 dias',
    rotation: 'Grid fixo com até 3 cards',
    extras: ['Destaque visual premium', 'Badge exclusivo', 'Relatório semanal'],
    tier: 'premium',
  },
  {
    key: 'showcase',
    config: POSITION_CONFIG['showcase'],
    price: 'R$ 399',
    period: '/mês',
    minDuration: '15 dias',
    rotation: 'Carrossel automático (6 posições)',
    extras: ['Animação de destaque', 'Relatório de cliques', 'Visibilidade na home'],
    tier: 'pro',
  },
  {
    key: 'card',
    config: POSITION_CONFIG['card'],
    price: 'R$ 299',
    period: '/mês',
    minDuration: '15 dias',
    rotation: 'Grid fixo com até 6 cards',
    extras: ['Seção de parceiros', 'Logo + descrição', 'Link direto'],
    tier: 'pro',
  },
  {
    key: 'banner',
    config: POSITION_CONFIG['banner'],
    price: 'R$ 349',
    period: '/mês',
    minDuration: '15 dias',
    rotation: 'Rotação entre até 3 banners',
    extras: ['Páginas internas (busca, vagas, blog)', 'Relatório de impressões'],
    tier: 'pro',
  },
  {
    key: 'between-sections',
    config: POSITION_CONFIG['between-sections'],
    price: 'R$ 449',
    period: '/mês',
    minDuration: '30 dias',
    rotation: 'Até 2 banners rotativos',
    extras: ['Alta visibilidade na home', 'Posição estratégica entre conteúdos'],
    tier: 'premium',
  },
  {
    key: 'mid-content',
    config: POSITION_CONFIG['mid-content'],
    price: 'R$ 249',
    period: '/mês',
    minDuration: '15 dias',
    rotation: 'Até 2 cards inline',
    extras: ['Integrado nas listagens', 'Experiência nativa'],
    tier: 'pro',
  },
  {
    key: 'sidebar',
    config: POSITION_CONFIG['sidebar'],
    price: 'R$ 199',
    period: '/mês',
    minDuration: '7 dias',
    rotation: 'Até 3 widgets fixos',
    extras: ['Desktop only', 'Coluna lateral persistente'],
    tier: 'basic',
  },
  {
    key: 'native',
    config: POSITION_CONFIG['native'],
    price: 'R$ 179',
    period: '/mês',
    minDuration: '7 dias',
    rotation: '1 card por listagem',
    extras: ['Intercalado com resultados', 'Aparência orgânica'],
    tier: 'basic',
  },
  {
    key: 'footer',
    config: POSITION_CONFIG['footer'],
    price: 'R$ 149',
    period: '/mês',
    minDuration: '7 dias',
    rotation: '1 banner fixo',
    extras: ['Todas as páginas', 'Visibilidade constante'],
    tier: 'basic',
  },
];

const tierColors: Record<string, string> = {
  premium: 'bg-primary text-primary-foreground',
  pro: 'bg-secondary text-secondary-foreground',
  basic: 'bg-muted text-muted-foreground',
};

const tierLabels: Record<string, string> = {
  premium: 'Premium',
  pro: 'PRO',
  basic: 'Básico',
};

function SlotAvailability({ positionKey }: { positionKey: string }) {
  const { data: sponsors, isLoading } = useSponsorsBySlot(positionKey);
  const { data: limits } = useSponsorSlotLimits();
  const config = POSITION_CONFIG[positionKey];

  const limit = limits?.find(
    (l: any) => l.context_type === 'global' && (l.context_value === positionKey || l.context_value === '_default')
  );
  const maxSlots = limit?.max_slots ?? config.maxItems;
  const occupied = sponsors?.length ?? 0;
  const remaining = Math.max(0, maxSlots - occupied);

  if (isLoading) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      {remaining === 0 ? (
        <Badge variant="destructive" className="text-xs">Esgotado</Badge>
      ) : remaining <= 1 ? (
        <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs border border-amber-300">
          Última vaga!
        </Badge>
      ) : (
        <Badge variant="outline" className="text-xs">
          {remaining} de {maxSlots} disponíveis
        </Badge>
      )}
    </div>
  );
}

const faqs = [
  {
    q: 'Como funciona a rotação de banners?',
    a: 'Nos espaços com múltiplas posições, seus banners alternam automaticamente com outros patrocinadores em intervalos regulares (geralmente 10 segundos), garantindo exposição equilibrada.',
  },
  {
    q: 'Posso trocar de plano ou espaço depois?',
    a: 'Sim! Você pode migrar entre espaços ou planos a qualquer momento. A diferença de valor é calculada proporcionalmente ao período restante.',
  },
  {
    q: 'O que são impressões garantidas?',
    a: 'No plano PRO, garantimos um número mínimo de exibições do seu anúncio. Se não atingirmos a meta, compensamos automaticamente com exibição adicional.',
  },
  {
    q: 'Como funciona o relatório de performance?',
    a: 'Você tem acesso a um dashboard exclusivo com métricas de impressões, cliques, CTR e ranking de páginas de maior conversão — atualizado em tempo real.',
  },
  {
    q: 'Existe duração mínima de contrato?',
    a: 'Cada espaço tem uma duração mínima (de 7 a 30 dias). Após o período mínimo, você pode renovar automaticamente ou cancelar com 30 dias de aviso.',
  },
  {
    q: 'Posso segmentar por cidade ou categoria?',
    a: 'Sim! Todos os espaços suportam segmentação por cidade e categoria, permitindo que sua marca apareça apenas para o público mais relevante.',
  },
];

export default function SponsorSlotsPage() {
  const navigate = useNavigate();
  const [tierFilter, setTierFilter] = useState<string>('all');

  const filtered = tierFilter === 'all'
    ? slotData
    : slotData.filter(s => s.tier === tierFilter);

  return (
    <TooltipProvider>
      <Header />
      <main className="bg-background">
        {/* Hero */}
        <section className="relative overflow-hidden bg-primary py-20 px-4">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 right-20 w-80 h-80 bg-secondary rounded-full blur-3xl" />
            <div className="absolute bottom-10 left-20 w-96 h-96 bg-white rounded-full blur-3xl" />
          </div>
          <div className="relative max-w-4xl mx-auto text-center">
            <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
              <Badge className="mb-6 bg-secondary text-secondary-foreground text-sm px-4 py-1.5">
                <Sparkles className="w-4 h-4 mr-2 inline" />
                Espaços limitados por região
              </Badge>
            </motion.div>
            <motion.h1
              initial="hidden" animate="visible" variants={fadeUp} custom={1}
              className="text-3xl md:text-5xl font-extrabold text-primary-foreground leading-tight mb-6"
            >
              Descubra nossos Espaços de Patrocínio
            </motion.h1>
            <motion.p
              initial="hidden" animate="visible" variants={fadeUp} custom={2}
              className="text-lg md:text-xl text-primary-foreground/80 max-w-2xl mx-auto mb-4"
            >
              Destaque sua marca na maior plataforma de serviços do Brasil.
              Transparência, performance e controle total sobre seu investimento.
            </motion.p>
            <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3} className="flex flex-wrap gap-4 justify-center mt-8">
              {[
                { icon: Eye, text: 'Visibilidade real' },
                { icon: BarChart3, text: 'Métricas em tempo real' },
                { icon: Shield, text: 'Impressões garantidas' },
                { icon: TrendingUp, text: 'ROI comprovado' },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-2 bg-primary-foreground/10 rounded-full px-4 py-2 text-primary-foreground text-sm">
                  <item.icon className="w-4 h-4" />
                  {item.text}
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Intro */}
        <section className="py-12 px-4 max-w-4xl mx-auto text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              O que são os Espaços de Patrocínio?
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed max-w-3xl mx-auto">
              São posições estratégicas na plataforma onde sua marca é exibida para milhares de usuários
              em busca de serviços profissionais. Cada espaço possui dimensões, rotação e visibilidade
              específicas, garantindo que seu investimento tenha o máximo retorno. Todos os espaços
              incluem relatórios de performance e suporte dedicado.
            </p>
          </motion.div>
        </section>

        {/* Filter */}
        <section className="px-4 max-w-6xl mx-auto mb-8">
          <div className="flex flex-wrap items-center gap-4 justify-between">
            <h2 className="text-xl font-bold text-foreground">
              {filtered.length} espaço{filtered.length !== 1 ? 's' : ''} disponíve{filtered.length !== 1 ? 'is' : 'l'}
            </h2>
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por plano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os planos</SelectItem>
                <SelectItem value="basic">Básico</SelectItem>
                <SelectItem value="pro">PRO</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        {/* Slots Grid */}
        <section className="px-4 max-w-6xl mx-auto pb-16">
          <div className="grid md:grid-cols-2 gap-6">
            {filtered.map((slot, i) => {
              const Icon = slot.config.icon;
              return (
                <motion.div
                  key={slot.key}
                  initial="hidden" whileInView="visible" viewport={{ once: true }}
                  variants={fadeUp} custom={i}
                >
                  <Card className="h-full hover:shadow-lg transition-shadow border-l-4 border-l-secondary overflow-hidden">
                    <CardContent className="p-6">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 bg-secondary/10 rounded-xl flex items-center justify-center shrink-0">
                            <Icon className={`w-5 h-5 ${slot.config.color}`} />
                          </div>
                          <div>
                            <h3 className="font-bold text-foreground text-lg leading-tight">{slot.config.label}</h3>
                            <p className="text-muted-foreground text-sm">{slot.config.description}</p>
                          </div>
                        </div>
                        <Badge className={`shrink-0 ${tierColors[slot.tier]}`}>
                          {tierLabels[slot.tier]}
                        </Badge>
                      </div>

                      {/* Price */}
                      <div className="flex items-baseline gap-1 mb-4">
                        <span className="text-3xl font-extrabold text-primary">{slot.price}</span>
                        <span className="text-muted-foreground text-sm">{slot.period}</span>
                      </div>

                      {/* Details */}
                      <div className="space-y-2 mb-4 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="w-4 h-4 shrink-0" />
                          <span>Duração mínima: <strong className="text-foreground">{slot.minDuration}</strong></span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center gap-1 cursor-help">
                                <RotateCw className="w-4 h-4 shrink-0" />
                                Rotação
                                <Info className="w-3 h-3" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Rotação define como os banners se alternam no espaço. Quanto mais posições, maior a divisão de visibilidade.</p>
                            </TooltipContent>
                          </Tooltip>
                          <span>: <strong className="text-foreground">{slot.rotation}</strong></span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Eye className="w-4 h-4 shrink-0" />
                          <span>Dimensões: <strong className="text-foreground">{slot.config.dimensions}</strong></span>
                        </div>
                      </div>

                      {/* Extras */}
                      <ul className="space-y-1.5 mb-5">
                        {slot.extras.map((extra) => (
                          <li key={extra} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <CheckCircle2 className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                            {extra}
                          </li>
                        ))}
                      </ul>

                      {/* Availability + CTA */}
                      <div className="flex items-center justify-between gap-3 pt-3 border-t">
                        <SlotAvailability positionKey={slot.key} />
                        <Button
                          size="sm"
                          onClick={() => navigate('/quero-ser-patrocinador')}
                          className="shrink-0"
                        >
                          Quero esse espaço <ArrowRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* CTA Banner */}
        <section className="py-16 px-4 bg-secondary/10">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
            className="max-w-3xl mx-auto text-center"
          >
            <Crown className="w-12 h-12 text-secondary mx-auto mb-4" />
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
              Pronto para destacar sua marca?
            </h2>
            <p className="text-muted-foreground text-lg mb-6">
              Cadastre-se como patrocinador e nossa equipe entrará em contato para montar o plano ideal para você.
            </p>
            <Button
              size="lg"
              className="text-lg px-8 py-6"
              onClick={() => navigate('/quero-ser-patrocinador')}
            >
              <Zap className="w-5 h-5 mr-2" /> Quero ser Patrocinador
            </Button>
          </motion.div>
        </section>

        {/* FAQ */}
        <section className="py-16 px-4 max-w-3xl mx-auto">
          <motion.h2
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
            className="text-2xl md:text-3xl font-bold text-center text-foreground mb-8"
          >
            Perguntas Frequentes
          </motion.h2>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeUp} custom={i}
              >
                <AccordionItem value={`faq-${i}`}>
                  <AccordionTrigger className="text-left">{faq.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
                </AccordionItem>
              </motion.div>
            ))}
          </Accordion>
        </section>
      </main>
      <Footer />
    </TooltipProvider>
  );
}
