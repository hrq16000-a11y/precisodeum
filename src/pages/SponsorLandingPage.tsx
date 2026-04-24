import { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, AnimatePresence, useInView } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Eye, BarChart3, Award, Globe, CheckCircle2, Rocket,
  TrendingUp, Shield, Zap, ArrowRight, FileText, Download, Star,
  Sparkles, Crown, Target, Users, MousePointerClick, LayoutGrid,
  Timer, Phone, Mail, Building2, ChevronDown, ChevronLeft, ChevronRight,
  Monitor, PieChart, Activity, X, Check, Minus, MessageSquare, HelpCircle, Upload
} from 'lucide-react';
import { SponsorDocsUploadModal } from '@/components/sponsor/SponsorDocsUploadModal';

const sponsorSchema = z.object({
  company_name: z.string().trim().min(2, 'Nome da empresa é obrigatório').max(200),
  cnpj: z.string().trim().min(14, 'CNPJ inválido').max(18),
  email: z.string().trim().email('Email inválido').max(255),
  phone: z.string().trim().min(10, 'Telefone inválido').max(20),
  plan: z.enum(['basic', 'pro', 'premium']),
});

type SponsorForm = z.infer<typeof sponsorSchema>;

const benefits = [
  { icon: Eye, title: 'Visibilidade Máxima', desc: 'Sua marca nos melhores espaços da plataforma, alcançando milhares de profissionais e clientes diariamente', metric: '50K+', metricLabel: 'impressões/mês' },
  { icon: BarChart3, title: 'Relatórios em Tempo Real', desc: 'Dashboard exclusivo com métricas detalhadas de impressões, cliques, CTR e conversões', metric: '24/7', metricLabel: 'monitoramento' },
  { icon: Award, title: 'Posições Premium', desc: 'Espaços estratégicos no topo, entre seções e em listagens para máxima visibilidade', metric: '10+', metricLabel: 'slots disponíveis' },
  { icon: Globe, title: 'Alcance Segmentado', desc: 'Segmentação inteligente por cidade, categoria e público para atingir seu mercado ideal', metric: '5.500+', metricLabel: 'cidades' },
  { icon: Shield, title: 'Impressões Garantidas', desc: 'Planos PRO e Premium com número mínimo de visualizações garantidas por período', metric: '100%', metricLabel: 'entrega garantida' },
  { icon: TrendingUp, title: 'ROI Comprovado', desc: 'Clientes reportam aumento médio de visibilidade e reconhecimento de marca significativos', metric: '3x', metricLabel: 'retorno médio' },
];

const plans = [
  {
    id: 'basic' as const,
    name: 'Básico',
    price: '199',
    features: ['1 banner ativo', 'Relatório mensal', 'Suporte por email', 'Segmentação por cidade'],
    gradient: 'from-slate-500 to-slate-600',
    glow: 'shadow-slate-500/20',
    iconColor: 'text-slate-400',
  },
  {
    id: 'pro' as const,
    name: 'PRO',
    price: '499',
    features: ['3 banners ativos', 'Impressões garantidas', 'Relatório semanal', 'Pacing inteligente', 'Suporte prioritário', 'Segmentação avançada'],
    gradient: 'from-blue-500 to-indigo-600',
    glow: 'shadow-blue-500/30',
    featured: true,
    iconColor: 'text-blue-400',
  },
  {
    id: 'premium' as const,
    name: 'Premium',
    price: '999',
    features: ['Banners ilimitados', 'Posições exclusivas', 'Relatório diário', 'Prioridade máxima', 'Impressões garantidas', 'Segmentação total'],
    gradient: 'from-amber-500 to-orange-600',
    glow: 'shadow-amber-500/30',
    iconColor: 'text-amber-400',
  },
];

const stats = [
  { value: '50K+', label: 'Impressões mensais', icon: Eye },
  { value: '5.500+', label: 'Cidades cobertas', icon: Globe },
  { value: '10K+', label: 'Profissionais ativos', icon: Users },
  { value: '98%', label: 'Satisfação', icon: Star },
];

const steps = [
  { step: 1, title: 'Escolha seu plano', desc: 'Selecione o plano ideal para o seu objetivo de marketing', icon: LayoutGrid },
  { step: 2, title: 'Cadastre sua empresa', desc: 'Preencha seus dados e aceite o contrato digital', icon: FileText },
  { step: 3, title: 'Ative sua campanha', desc: 'Nossa equipe configura tudo e sua marca começa a brilhar', icon: Rocket },
];

const testimonials = [
  { name: 'Carlos M.', role: 'Gestor de Marketing', company: 'AutoPeças Express', rating: 5, text: 'A plataforma transformou nossa visibilidade. Em 3 meses, triplicamos os contatos qualificados.', avatar: 'CM' },
  { name: 'Fernanda S.', role: 'Diretora Comercial', company: 'Clean House SP', rating: 5, text: 'O dashboard de métricas é sensacional. Consigo acompanhar cada centavo investido em tempo real.', avatar: 'FS' },
  { name: 'Roberto L.', role: 'CEO', company: 'TechFix Soluções', rating: 5, text: 'Melhor investimento em marketing digital que fizemos. O suporte é excepcional e os resultados são reais.', avatar: 'RL' },
  { name: 'Ana Paula R.', role: 'Coord. de Marketing', company: 'Bella Reformas', rating: 4, text: 'A segmentação por cidade nos permitiu focar exatamente no público que queríamos. Retorno em 2 semanas!', avatar: 'AP' },
  { name: 'Diego F.', role: 'Proprietário', company: 'DF Climatização', rating: 5, text: 'Desde que começamos a patrocinar, nosso telefone não para. A visibilidade é incomparável.', avatar: 'DF' },
];

const comparisonFeatures = [
  { label: 'Banners ativos', basic: '1', pro: '3', premium: 'Ilimitados' },
  { label: 'Relatórios', basic: 'Mensal', pro: 'Semanal', premium: 'Diário' },
  { label: 'Impressões garantidas', basic: false, pro: true, premium: true },
  { label: 'Pacing inteligente', basic: false, pro: true, premium: true },
  { label: 'Segmentação por cidade', basic: true, pro: true, premium: true },
  { label: 'Segmentação por categoria', basic: false, pro: true, premium: true },
  { label: 'Posições exclusivas', basic: false, pro: false, premium: true },
  { label: 'Prioridade máxima', basic: false, pro: false, premium: true },
  { label: 'Dashboard de métricas', basic: true, pro: true, premium: true },
  { label: 'Suporte prioritário', basic: false, pro: true, premium: true },
];

const faqs = [
  { q: 'Como funciona o pagamento?', a: 'Os pagamentos são mensais via boleto, PIX ou cartão de crédito. Não há taxa de adesão e você pode cancelar a qualquer momento com aviso prévio de 30 dias.' },
  { q: 'Posso trocar de plano depois?', a: 'Sim! Você pode fazer upgrade ou downgrade do plano a qualquer momento. As alterações entram em vigor no próximo ciclo de cobrança.' },
  { q: 'Como funciona a segmentação?', a: 'Dependendo do seu plano, você pode segmentar por cidade, estado, categoria de serviço e até palavras-chave. Isso garante que sua marca apareça exatamente para o público certo.' },
  { q: 'O que são "Impressões Garantidas"?', a: 'Nos planos PRO e Premium, garantimos um número mínimo de visualizações dos seus banners por mês. Se não atingirmos a meta, estendemos a campanha sem custo adicional.' },
  { q: 'Preciso fornecer o material do banner?', a: 'Você pode enviar seu próprio banner (recomendamos 1600x200px) ou nossa equipe de design pode criar um para você sem custo adicional nos planos PRO e Premium.' },
  { q: 'Quanto tempo leva para ativar minha campanha?', a: 'Após a aprovação do cadastro e pagamento, sua campanha é ativada em até 24 horas úteis. Campanhas Premium têm prioridade na ativação.' },
  { q: 'Consigo acompanhar os resultados?', a: 'Sim! Todos os planos incluem acesso ao dashboard com métricas de impressões, cliques e CTR em tempo real. Planos superiores têm relatórios mais detalhados.' },
];

const contractText = `CONTRATO DE PATROCÍNIO

Entre:
Plataforma: Preciso de Um, representada por Ping Soluções LTDA, CNPJ XXX.XXX.XXX/XXXX-XX, doravante denominada "Plataforma".
Patrocinador: A empresa identificada no formulário de inscrição, doravante denominado "Patrocinador".

1. OBJETO
O presente contrato tem como objeto o patrocínio do Patrocinador na Plataforma "Preciso de Um", garantindo a veiculação de anúncios, banners e outros materiais de marketing conforme o plano contratado.

2. PLANOS E CONDIÇÕES
2.1 O Patrocinador escolhe o plano Básico, PRO ou Premium, com duração mensal ou anual.
2.2 Os valores e formas de pagamento estão detalhados na proposta comercial.
2.3 O patrocínio garante exposição no(s) espaço(s) contratado(s), respeitando o limite de impressões e a segmentação definida.

3. OBRIGAÇÕES DA PLATAFORMA
3.1 Veicular os anúncios do Patrocinador conforme plano contratado.
3.2 Garantir relatórios de impressões e desempenho, quando aplicável.
3.3 Manter o conteúdo da Plataforma em conformidade com normas legais.

4. OBRIGAÇÕES DO PATROCINADOR
4.1 Fornecer conteúdo correto, atualizado e legalmente permitido para veiculação.
4.2 Pagar pontualmente os valores acordados no plano escolhido.
4.3 Não divulgar conteúdo ofensivo, ilegal ou que viole direitos de terceiros.

5. VIGÊNCIA E RESCISÃO
Este contrato terá vigência conforme o plano escolhido, podendo ser rescindido por qualquer das partes mediante aviso prévio de 30 dias. A rescisão não isenta o pagamento das obrigações pendentes.

6. GARANTIAS E LIMITAÇÕES
A Plataforma não se responsabiliza por resultados de vendas ou conversões gerados pelos anúncios. Eventuais problemas técnicos serão corrigidos sem prejuízo ao Patrocinador.

7. DISPOSIÇÕES GERAIS
7.1 O presente contrato não estabelece sociedade, vínculo empregatício ou parceria jurídica entre as partes além do patrocínio.
7.2 Qualquer alteração neste contrato deve ser formalizada por escrito.
7.3 As partes elegem o foro da Comarca de Curitiba/PR para dirimir quaisquer controvérsias.

© 2026 Preciso de Um — Todos os direitos reservados`;

// Animated counter
function AnimatedNumber({ target, suffix = '' }: { target: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);
  const numericTarget = parseInt(target.replace(/\D/g, '')) || 0;

  useEffect(() => {
    if (!isInView || numericTarget === 0) return;
    let start = 0;
    const duration = 2000;
    const step = Math.ceil(numericTarget / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= numericTarget) {
        setCount(numericTarget);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, numericTarget]);

  const displayValue = target.includes('K') ? `${Math.floor(count / 1000)}K` : target.includes('%') ? `${count}%` : `${count.toLocaleString('pt-BR')}`;

  return (
    <span ref={ref}>
      {isInView ? `${displayValue}${target.endsWith('+') ? '+' : ''}${suffix}` : '0'}
    </span>
  );
}

// Floating particles
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-white/10"
          style={{
            width: Math.random() * 6 + 2,
            height: Math.random() * 6 + 2,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.random() * 20 - 10, 0],
            opacity: [0.2, 0.6, 0.2],
          }}
          transition={{
            duration: Math.random() * 4 + 4,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: Math.random() * 3,
          }}
        />
      ))}
    </div>
  );
}

// Gradient orbs
function GradientOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, hsl(var(--secondary)), transparent 70%)', top: '-10%', right: '-5%' }}
        animate={{ scale: [1, 1.2, 1], rotate: [0, 45, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full opacity-15"
        style={{ background: 'radial-gradient(circle, hsl(var(--accent)), transparent 70%)', bottom: '-5%', left: '-5%' }}
        animate={{ scale: [1.2, 1, 1.2], rotate: [0, -30, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute w-[300px] h-[300px] rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, hsl(var(--primary-foreground)), transparent 70%)', top: '40%', left: '30%' }}
        animate={{ scale: [1, 1.3, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

// Dashboard Mockup
function DashboardMockup() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const mockMetrics = [
    { label: 'Impressões', value: '12.847', change: '+18%', icon: Eye },
    { label: 'Cliques', value: '934', change: '+12%', icon: MousePointerClick },
    { label: 'CTR', value: '7.2%', change: '+0.8%', icon: Target },
    { label: 'Conversões', value: '47', change: '+23%', icon: TrendingUp },
  ];

  const chartBars = [65, 78, 45, 89, 72, 95, 83];
  const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  return (
    <div ref={ref}>
      <motion.div
        initial={{ opacity: 0, y: 40, rotateX: 10 }}
        animate={isInView ? { opacity: 1, y: 0, rotateX: 0 } : {}}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="relative max-w-4xl mx-auto"
        style={{ perspective: '1000px' }}
      >
        {/* Browser chrome */}
        <div className="bg-card rounded-t-2xl border border-border/50 shadow-2xl shadow-secondary/10">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-destructive/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-400/60" />
              <div className="w-3 h-3 rounded-full bg-green-400/60" />
            </div>
            <div className="flex-1 mx-4">
              <div className="bg-muted/50 rounded-lg px-3 py-1.5 text-xs text-muted-foreground flex items-center gap-2">
                <Shield className="w-3 h-3 text-green-500" />
                sponsor-panel.precisodeum.com/dashboard
              </div>
            </div>
          </div>

          {/* Dashboard content */}
          <div className="p-4 md:p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <motion.h3
                  initial={{ opacity: 0, x: -20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.3 }}
                  className="text-lg font-bold text-foreground"
                >
                  Painel do Patrocinador
                </motion.h3>
                <p className="text-xs text-muted-foreground">Últimos 7 dias</p>
              </div>
              <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                <Activity className="w-3 h-3 mr-1" /> Ativo
              </Badge>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {mockMetrics.map((m, i) => (
                <motion.div
                  key={m.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  className="bg-muted/30 rounded-xl p-3 border border-border/30"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <m.icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{m.label}</span>
                  </div>
                  <p className="text-xl font-bold text-foreground">{m.value}</p>
                  <span className="text-xs text-green-500 font-medium">{m.change}</span>
                </motion.div>
              ))}
            </div>

            {/* Chart */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ delay: 0.8 }}
              className="bg-muted/20 rounded-xl p-4 border border-border/30"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-foreground">Impressões por dia</span>
                <PieChart className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex items-end gap-2 h-24">
                {chartBars.map((height, i) => (
                  <motion.div
                    key={i}
                    className="flex-1 flex flex-col items-center gap-1"
                    initial={{ scaleY: 0 }}
                    animate={isInView ? { scaleY: 1 } : {}}
                    transition={{ delay: 1 + i * 0.08, duration: 0.5 }}
                    style={{ originY: 1 }}
                  >
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-secondary to-secondary/60"
                      style={{ height: `${height}%` }}
                    />
                    <span className="text-[10px] text-muted-foreground">{days[i]}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
        <div className="bg-card rounded-b-2xl border-x border-b border-border/50 h-2" />

        {/* Floating glow */}
        <div className="absolute -inset-4 bg-gradient-to-r from-secondary/5 via-accent/5 to-secondary/5 rounded-3xl -z-10 blur-xl" />
      </motion.div>
    </div>
  );
}

// Testimonials Carousel
function TestimonialsCarousel() {
  const [current, setCurrent] = useState(0);
  const [autoplay, setAutoplay] = useState(true);

  useEffect(() => {
    if (!autoplay) return;
    const timer = setInterval(() => {
      setCurrent(c => (c + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [autoplay]);

  const prev = () => { setAutoplay(false); setCurrent(c => (c - 1 + testimonials.length) % testimonials.length); };
  const next = () => { setAutoplay(false); setCurrent(c => (c + 1) % testimonials.length); };

  return (
    <div className="relative max-w-4xl mx-auto">
      <div className="overflow-hidden rounded-2xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="border-2 border-secondary/10 shadow-xl bg-card/80 backdrop-blur-sm">
              <CardContent className="p-8 md:p-12">
                <div className="flex items-center gap-1 mb-6">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star
                      key={s}
                      className={`w-5 h-5 ${s <= testimonials[current].rating ? 'fill-amber-400 text-amber-400' : 'text-muted'}`}
                    />
                  ))}
                </div>

                <blockquote className="text-xl md:text-2xl text-foreground font-medium italic leading-relaxed mb-8">
                  "{testimonials[current].text}"
                </blockquote>

                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-secondary to-accent flex items-center justify-center text-white font-bold text-lg shadow-lg">
                    {testimonials[current].avatar}
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{testimonials[current].name}</p>
                    <p className="text-sm text-muted-foreground">{testimonials[current].role}</p>
                    <p className="text-xs text-secondary font-medium">{testimonials[current].company}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-4 mt-6">
        <Button variant="outline" size="icon" onClick={prev} className="rounded-full w-10 h-10">
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <div className="flex gap-2">
          {testimonials.map((_, i) => (
            <button
              key={i}
              onClick={() => { setAutoplay(false); setCurrent(i); }}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === current ? 'w-8 bg-secondary' : 'w-2 bg-muted-foreground/20 hover:bg-muted-foreground/40'
              }`}
            />
          ))}
        </div>

        <Button variant="outline" size="icon" onClick={next} className="rounded-full w-10 h-10">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// Comparison cell renderer
function ComparisonCell({ value }: { value: boolean | string }) {
  if (typeof value === 'string') {
    return <span className="text-sm font-medium text-foreground">{value}</span>;
  }
  return value ? (
    <Check className="w-5 h-5 text-green-500 mx-auto" />
  ) : (
    <Minus className="w-5 h-5 text-muted-foreground/30 mx-auto" />
  );
}

export default function SponsorLandingPage() {
  const [contractAccepted, setContractAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'pro' | 'premium'>('pro');
  const [hoveredBenefit, setHoveredBenefit] = useState<number | null>(null);

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const { register, handleSubmit, formState: { errors }, setValue } = useForm<SponsorForm>({
    resolver: zodResolver(sponsorSchema),
    defaultValues: { plan: 'pro' },
  });

  const onSubmit = async (data: SponsorForm) => {
    if (!contractAccepted) {
      toast.error('Você precisa aceitar o contrato para continuar.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('sponsor_leads' as any).insert({
        company_name: data.company_name,
        cnpj: data.cnpj,
        email: data.email,
        phone: data.phone,
        plan: data.plan,
        contract_accepted: true,
        status: 'pending',
      } as any);
      if (error) throw error;
      setSubmitted(true);
      toast.success('Interesse registrado com sucesso!');
    } catch {
      toast.error('Erro ao enviar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadContract = () => {
    const blob = new Blob([contractText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Contrato_Patrocinio_PrecisodeUm.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (submitted) {
    return (
      <>
        <Header />
        <main className="min-h-screen flex items-center justify-center bg-background px-4">
          <motion.div
            initial={{ scale: 0.5, opacity: 0, rotateY: -20 }}
            animate={{ scale: 1, opacity: 1, rotateY: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="text-center max-w-lg"
          >
            <motion.div
              className="w-24 h-24 bg-gradient-to-br from-accent to-secondary rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-accent/30"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <CheckCircle2 className="w-12 h-12 text-white" />
            </motion.div>
            <h1 className="text-4xl font-bold text-foreground mb-4">Solicitação recebida!</h1>
            <p className="text-lg text-muted-foreground mb-2">
              Status: <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-sm font-semibold">Pendente de análise</span>
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Nossa equipe entrará em contato em até <strong className="text-foreground">24 horas úteis</strong>.
            </p>
            <div className="text-left bg-muted/40 border border-border rounded-2xl p-5 mb-8">
              <p className="text-sm font-semibold text-foreground mb-3">Próximos passos</p>
              <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                <li>Validação dos dados da empresa e do CNPJ informado.</li>
                <li>Envio do contrato definitivo e da proposta comercial por e-mail.</li>
                <li>Configuração da campanha e ativação dos slots de patrocínio.</li>
                <li>Liberação do painel do patrocinador com métricas em tempo real.</li>
              </ol>
            </div>
            <Button onClick={() => window.location.href = '/'} size="lg" className="px-8">
              <ArrowRight className="w-4 h-4 mr-2" /> Voltar ao Início
            </Button>
          </motion.div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="bg-background overflow-hidden">
        {/* ====== HERO ====== */}
        <section ref={heroRef} className="relative min-h-[90vh] flex items-center overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/90">
          <GradientOrbs />
          <FloatingParticles />
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'linear-gradient(hsl(var(--primary-foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary-foreground)) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }} />

          <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative w-full">
            <div className="max-w-5xl mx-auto px-4 py-20 text-center">
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
              >
                <Badge className="mb-8 bg-white/10 backdrop-blur-md text-primary-foreground text-sm px-5 py-2 border border-white/20 shadow-lg">
                  <motion.span animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 2, repeat: Infinity, delay: 1 }}>
                    <Crown className="w-4 h-4 mr-2 inline text-amber-300" />
                  </motion.span>
                  Vagas limitadas por região — Garanta a sua!
                </Badge>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.7 }}
                className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-primary-foreground leading-[1.1] mb-6"
              >
                Destaque sua marca na
                <br />
                <span className="relative inline-block">
                  <span className="bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text text-transparent">
                    maior plataforma
                  </span>
                  <motion.span
                    className="absolute -bottom-2 left-0 right-0 h-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 1, duration: 0.8 }}
                  />
                </span>
                <br />
                de serviços do Brasil
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.6 }}
                className="text-lg md:text-xl text-primary-foreground/70 max-w-2xl mx-auto mb-10 leading-relaxed"
              >
                Conecte sua marca a milhares de profissionais e clientes.
                Visibilidade real, métricas comprovadas e retorno garantido.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
              >
                <Button
                  size="lg"
                  className="text-lg px-10 py-7 bg-gradient-to-r from-secondary to-accent text-secondary-foreground shadow-xl shadow-secondary/30 hover:shadow-2xl hover:shadow-secondary/40 transition-all"
                  onClick={() => document.getElementById('form-section')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  <Rocket className="w-5 h-5 mr-2" />
                  Quero ser Patrocinador
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-8 py-7 bg-white/5 border-white/20 text-primary-foreground backdrop-blur-sm hover:bg-white/10"
                  onClick={() => document.getElementById('plans-section')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  Ver Planos <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
                className="flex flex-wrap justify-center gap-6 md:gap-10"
              >
                {stats.map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.2 + i * 0.1 }}
                    className="flex items-center gap-3 bg-white/5 backdrop-blur-sm rounded-2xl px-5 py-3 border border-white/10"
                  >
                    <stat.icon className="w-5 h-5 text-amber-300/80" />
                    <div className="text-left">
                      <p className="text-xl font-bold text-primary-foreground leading-none">
                        <AnimatedNumber target={stat.value} />
                      </p>
                      <p className="text-xs text-primary-foreground/50">{stat.label}</p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </motion.div>

          <div className="absolute bottom-0 left-0 right-0">
            <svg viewBox="0 0 1440 120" className="w-full h-16 md:h-24 fill-background">
              <path d="M0,60 C360,120 720,0 1080,60 C1260,90 1380,60 1440,40 L1440,120 L0,120 Z" />
            </svg>
          </div>
        </section>

        {/* ====== BENEFITS ====== */}
        <section className="py-20 md:py-28 px-4">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <Badge variant="outline" className="mb-4 text-secondary border-secondary/30">
                <Sparkles className="w-3 h-3 mr-1" /> Por que patrocinar?
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Tudo que sua marca precisa para{' '}
                <span className="text-secondary">crescer</span>
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Uma plataforma completa de visibilidade com métricas reais e resultados mensuráveis
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {benefits.map((b, i) => (
                <motion.div
                  key={b.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  onMouseEnter={() => setHoveredBenefit(i)}
                  onMouseLeave={() => setHoveredBenefit(null)}
                >
                  <Card className={`h-full transition-all duration-500 border-2 group cursor-default ${
                    hoveredBenefit === i
                      ? 'border-secondary/50 shadow-xl shadow-secondary/10 -translate-y-2'
                      : 'border-transparent hover:border-border/50'
                  }`}>
                    <CardContent className="p-6 relative overflow-hidden">
                      <motion.div
                        className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-secondary/5"
                        animate={hoveredBenefit === i ? { scale: 2, opacity: 1 } : { scale: 1, opacity: 0 }}
                        transition={{ duration: 0.5 }}
                      />
                      <div className="relative">
                        <div className="flex items-start justify-between mb-4">
                          <motion.div
                            className="w-14 h-14 bg-gradient-to-br from-secondary/10 to-secondary/5 rounded-2xl flex items-center justify-center border border-secondary/10"
                            animate={hoveredBenefit === i ? { rotate: [0, -5, 5, 0], scale: 1.05 } : {}}
                            transition={{ duration: 0.5 }}
                          >
                            <b.icon className="w-7 h-7 text-secondary" />
                          </motion.div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-foreground leading-none">{b.metric}</p>
                            <p className="text-[10px] text-muted-foreground">{b.metricLabel}</p>
                          </div>
                        </div>
                        <h3 className="font-bold text-foreground text-lg mb-2 group-hover:text-secondary transition-colors">{b.title}</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">{b.desc}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ====== DASHBOARD MOCKUP ====== */}
        <section className="py-20 md:py-28 px-4 bg-muted/20 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.02]" style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)',
            backgroundSize: '40px 40px',
          }} />
          <div className="max-w-6xl mx-auto relative">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <Badge variant="outline" className="mb-4 text-secondary border-secondary/30">
                <Monitor className="w-3 h-3 mr-1" /> Preview do Dashboard
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Acompanhe tudo em <span className="text-secondary">tempo real</span>
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Dashboard completo com impressões, cliques, CTR e muito mais — tudo ao seu alcance
              </p>
            </motion.div>

            <DashboardMockup />
          </div>
        </section>

        {/* ====== HOW IT WORKS ====== */}
        <section className="py-20 px-4 relative overflow-hidden">
          <div className="max-w-5xl mx-auto relative">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <Badge variant="outline" className="mb-4">
                <Timer className="w-3 h-3 mr-1" /> Simples e rápido
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                Como funciona
              </h2>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8 relative">
              <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-secondary/30 to-transparent" />
              {steps.map((s, i) => (
                <motion.div
                  key={s.step}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  className="text-center relative"
                >
                  <motion.div
                    className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-secondary to-accent flex items-center justify-center shadow-lg shadow-secondary/20 relative z-10"
                    whileHover={{ scale: 1.1, rotate: 5 }}
                  >
                    <s.icon className="w-7 h-7 text-white" />
                  </motion.div>
                  <div className="absolute top-5 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-background border-2 border-secondary flex items-center justify-center text-secondary font-bold text-sm z-20">
                    {s.step}
                  </div>
                  <h3 className="font-bold text-foreground text-lg mb-2">{s.title}</h3>
                  <p className="text-muted-foreground text-sm">{s.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ====== PLANS ====== */}
        <section id="plans-section" className="py-20 md:py-28 px-4 bg-muted/30 relative">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <Badge variant="outline" className="mb-4 text-primary border-primary/30">
                <Crown className="w-3 h-3 mr-1" /> Planos
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Escolha o plano ideal para sua marca
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Investimento acessível com retorno comprovado. Todos os planos incluem dashboard de métricas.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
              {plans.map((plan, i) => (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12 }}
                  className={plan.featured ? 'md:-mt-4 md:mb-0' : ''}
                >
                  <Card
                    className={`relative h-full cursor-pointer transition-all duration-300 overflow-hidden group ${
                      selectedPlan === plan.id
                        ? `ring-2 ring-secondary shadow-2xl ${plan.glow} scale-[1.02]`
                        : 'hover:shadow-lg hover:-translate-y-1'
                    } ${plan.featured ? 'border-2 border-secondary' : 'border'}`}
                    onClick={() => { setSelectedPlan(plan.id); setValue('plan', plan.id); }}
                  >
                    <div className={`h-1.5 bg-gradient-to-r ${plan.gradient}`} />

                    {plan.featured && (
                      <div className="absolute -top-0 left-1/2 -translate-x-1/2 translate-y-2">
                        <motion.div
                          animate={{ y: [0, -3, 0] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <Badge className="bg-gradient-to-r from-secondary to-accent text-white px-4 py-1 shadow-lg">
                            <Star className="w-3 h-3 mr-1" /> Mais Popular
                          </Badge>
                        </motion.div>
                      </div>
                    )}

                    <CardContent className="p-6 pt-10 flex flex-col h-full">
                      <div className="mb-6">
                        <h3 className="text-xl font-bold text-foreground mb-1">{plan.name}</h3>
                        <div className="flex items-baseline gap-1 mb-1">
                          <span className="text-sm text-muted-foreground">R$</span>
                          <span className="text-5xl font-extrabold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                            {plan.price}
                          </span>
                          <span className="text-muted-foreground text-sm">/mês</span>
                        </div>
                      </div>

                      <ul className="space-y-3 flex-1">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                            <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${plan.iconColor}`} />
                            {f}
                          </li>
                        ))}
                      </ul>

                      <Button
                        className={`w-full mt-6 ${
                          selectedPlan === plan.id
                            ? `bg-gradient-to-r ${plan.gradient} text-white`
                            : ''
                        }`}
                        variant={selectedPlan === plan.id ? 'default' : 'outline'}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPlan(plan.id);
                          setValue('plan', plan.id);
                          document.getElementById('form-section')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                      >
                        {selectedPlan === plan.id ? (
                          <><CheckCircle2 className="w-4 h-4 mr-2" /> Selecionado</>
                        ) : (
                          <>Escolher {plan.name}</>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* ====== COMPARISON TABLE ====== */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mt-16"
            >
              <div className="text-center mb-8">
                <h3 className="text-xl font-bold text-foreground">Comparativo detalhado</h3>
                <p className="text-sm text-muted-foreground mt-1">Veja tudo que cada plano oferece</p>
              </div>

              <Card className="overflow-hidden border-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-6 py-4 font-medium text-muted-foreground">Recurso</th>
                        <th className="text-center px-4 py-4 font-bold text-foreground">
                          <div className="flex flex-col items-center gap-1">
                            <span>Básico</span>
                            <span className="text-xs font-normal text-muted-foreground">R$ 199/mês</span>
                          </div>
                        </th>
                        <th className="text-center px-4 py-4 font-bold text-secondary relative">
                          <div className="flex flex-col items-center gap-1">
                            <Badge className="bg-secondary/10 text-secondary text-[10px] px-2 py-0 mb-1">Popular</Badge>
                            <span>PRO</span>
                            <span className="text-xs font-normal text-muted-foreground">R$ 499/mês</span>
                          </div>
                        </th>
                        <th className="text-center px-4 py-4 font-bold text-foreground">
                          <div className="flex flex-col items-center gap-1">
                            <Crown className="w-4 h-4 text-amber-500 mb-1" />
                            <span>Premium</span>
                            <span className="text-xs font-normal text-muted-foreground">R$ 999/mês</span>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonFeatures.map((feat, i) => (
                        <motion.tr
                          key={feat.label}
                          initial={{ opacity: 0, x: -20 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: i * 0.03 }}
                          className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-6 py-3.5 text-foreground font-medium">{feat.label}</td>
                          <td className="px-4 py-3.5 text-center"><ComparisonCell value={feat.basic} /></td>
                          <td className="px-4 py-3.5 text-center bg-secondary/[0.03]"><ComparisonCell value={feat.pro} /></td>
                          <td className="px-4 py-3.5 text-center"><ComparisonCell value={feat.premium} /></td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* ====== TESTIMONIALS CAROUSEL ====== */}
        <section className="py-20 md:py-28 px-4 relative">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <Badge variant="outline" className="mb-4 text-secondary border-secondary/30">
                <MessageSquare className="w-3 h-3 mr-1" /> Depoimentos
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                O que nossos patrocinadores <span className="text-secondary">dizem</span>
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Empresas reais, resultados reais
              </p>
            </motion.div>

            <TestimonialsCarousel />
          </div>
        </section>

        {/* ====== FAQ ====== */}
        <section className="py-20 md:py-28 px-4 bg-muted/20 relative overflow-hidden">
          <div className="max-w-3xl mx-auto relative">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <Badge variant="outline" className="mb-4">
                <HelpCircle className="w-3 h-3 mr-1" /> Dúvidas frequentes
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Perguntas frequentes
              </h2>
              <p className="text-muted-foreground">
                Tire suas dúvidas sobre o programa de patrocínio
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <Accordion type="single" collapsible className="space-y-3">
                {faqs.map((faq, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <AccordionItem value={`faq-${i}`} className="bg-card border rounded-xl px-6 shadow-sm hover:shadow-md transition-shadow">
                      <AccordionTrigger className="text-left text-foreground font-medium hover:text-secondary transition-colors py-5">
                        {faq.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground leading-relaxed pb-5">
                        {faq.a}
                      </AccordionContent>
                    </AccordionItem>
                  </motion.div>
                ))}
              </Accordion>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-center mt-8"
            >
              <p className="text-sm text-muted-foreground">
                Ainda tem dúvidas?{' '}
                <a href="mailto:contato@precisodeum.com" className="text-secondary font-medium hover:underline">
                  Fale conosco
                </a>
              </p>
            </motion.div>
          </div>
        </section>

        {/* ====== FORM ====== */}
        <section id="form-section" className="py-20 md:py-28 px-4 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-secondary/3 blur-3xl pointer-events-none" />

          <div className="max-w-2xl mx-auto relative">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div className="text-center mb-10">
                <Badge variant="outline" className="mb-4 text-accent border-accent/30">
                  <Zap className="w-3 h-3 mr-1" /> Cadastro rápido
                </Badge>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
                  Cadastre-se como Patrocinador
                </h2>
                <p className="text-muted-foreground">
                  Preencha seus dados e nossa equipe entra em contato em até 24h
                </p>
              </div>

              <Card className="border-2 shadow-xl shadow-secondary/5 overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-secondary via-accent to-primary" />

                <CardContent className="p-6 md:p-10">
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div>
                      <Label htmlFor="company_name" className="flex items-center gap-2 mb-2 text-sm font-medium">
                        <Building2 className="w-4 h-4 text-muted-foreground" /> Nome da Empresa
                      </Label>
                      <Input id="company_name" {...register('company_name')} placeholder="Sua empresa" className="h-12" />
                      {errors.company_name && <p className="text-destructive text-sm mt-1">{errors.company_name.message}</p>}
                    </div>

                    <div>
                      <Label htmlFor="cnpj" className="flex items-center gap-2 mb-2 text-sm font-medium">
                        <FileText className="w-4 h-4 text-muted-foreground" /> CNPJ
                      </Label>
                      <Input id="cnpj" {...register('cnpj')} placeholder="00.000.000/0000-00" className="h-12" />
                      {errors.cnpj && <p className="text-destructive text-sm mt-1">{errors.cnpj.message}</p>}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="email" className="flex items-center gap-2 mb-2 text-sm font-medium">
                          <Mail className="w-4 h-4 text-muted-foreground" /> Email
                        </Label>
                        <Input id="email" type="email" {...register('email')} placeholder="contato@empresa.com" className="h-12" />
                        {errors.email && <p className="text-destructive text-sm mt-1">{errors.email.message}</p>}
                      </div>

                      <div>
                        <Label htmlFor="phone" className="flex items-center gap-2 mb-2 text-sm font-medium">
                          <Phone className="w-4 h-4 text-muted-foreground" /> WhatsApp
                        </Label>
                        <Input id="phone" {...register('phone')} placeholder="(41) 99999-9999" className="h-12" />
                        {errors.phone && <p className="text-destructive text-sm mt-1">{errors.phone.message}</p>}
                      </div>
                    </div>

                    <div>
                      <Label className="flex items-center gap-2 mb-2 text-sm font-medium">
                        <Crown className="w-4 h-4 text-muted-foreground" /> Plano selecionado
                      </Label>
                      <Select value={selectedPlan} onValueChange={(v: 'basic' | 'pro' | 'premium') => {
                        setSelectedPlan(v);
                        setValue('plan', v);
                      }}>
                        <SelectTrigger className="h-12">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="basic">Básico — R$ 199/mês</SelectItem>
                          <SelectItem value="pro">PRO — R$ 499/mês</SelectItem>
                          <SelectItem value="premium">Premium — R$ 999/mês</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Contract */}
                    <div className="rounded-xl border border-border bg-muted/30 p-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="contract"
                          checked={contractAccepted}
                          onCheckedChange={(v) => setContractAccepted(v === true)}
                          className="mt-0.5"
                        />
                        <label htmlFor="contract" className="text-sm text-muted-foreground leading-snug">
                          Li e aceito o{' '}
                          <Dialog>
                            <DialogTrigger asChild>
                              <button type="button" className="text-secondary underline font-medium hover:text-accent transition-colors">
                                Contrato de Patrocínio
                              </button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                  <FileText className="w-5 h-5 text-primary" />
                                  Contrato de Patrocínio
                                </DialogTitle>
                              </DialogHeader>
                              <div className="overflow-y-auto flex-1 pr-2 -mr-2">
                                <pre className="whitespace-pre-wrap text-sm text-foreground font-sans leading-relaxed">
                                  {contractText}
                                </pre>
                              </div>
                              <div className="pt-4 border-t flex gap-3 justify-end">
                                <Button variant="outline" size="sm" onClick={handleDownloadContract}>
                                  <Download className="w-4 h-4 mr-2" /> Download
                                </Button>
                                <Button size="sm" onClick={() => {
                                  setContractAccepted(true);
                                  const closeBtn = document.querySelector('[data-radix-collection-item]');
                                  if (closeBtn instanceof HTMLElement) closeBtn.click();
                                }}>
                                  <CheckCircle2 className="w-4 h-4 mr-2" /> Aceitar Contrato
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </label>
                      </div>
                    </div>

                    <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                      <Button
                        type="submit"
                        size="lg"
                        className="w-full text-lg py-7 bg-gradient-to-r from-secondary via-accent to-primary text-white shadow-xl shadow-secondary/20 hover:shadow-2xl hover:shadow-secondary/30 transition-all relative overflow-hidden group"
                        disabled={!contractAccepted || submitting}
                      >
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                          animate={{ x: ['-100%', '100%'] }}
                          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                        />
                        <span className="relative flex items-center justify-center gap-2">
                          {submitting ? (
                            <>
                              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                                <Zap className="w-5 h-5" />
                              </motion.div>
                              Enviando...
                            </>
                          ) : (
                            <>
                              <Rocket className="w-5 h-5" />
                              Quero ser Patrocinador
                              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </>
                          )}
                        </span>
                      </Button>
                    </motion.div>

                    <div className="flex items-center justify-center gap-6 text-muted-foreground text-xs pt-2">
                      <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Dados protegidos</span>
                      <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Resposta em 24h</span>
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Sem compromisso</span>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* ====== FINAL CTA ====== */}
        <section className="relative py-20 px-4 bg-gradient-to-br from-primary to-primary/95 overflow-hidden">
          <FloatingParticles />
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--primary-foreground)) 1px, transparent 0)',
            backgroundSize: '30px 30px',
          }} />
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center relative"
          >
            <motion.div
              className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              <Crown className="w-8 h-8 text-amber-300" />
            </motion.div>
            <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
              Sua marca merece ser vista
            </h2>
            <p className="text-primary-foreground/70 text-lg mb-8 max-w-xl mx-auto">
              Junte-se às empresas que já confiam na nossa plataforma para alcançar milhares de clientes qualificados.
            </p>
            <Button
              size="lg"
              className="text-lg px-10 py-7 bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-xl shadow-amber-500/30 hover:shadow-2xl hover:shadow-amber-500/40"
              onClick={() => document.getElementById('form-section')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <Sparkles className="w-5 h-5 mr-2" /> Começar Agora
            </Button>
          </motion.div>
        </section>
      </main>
      <Footer />
    </>
  );
}
