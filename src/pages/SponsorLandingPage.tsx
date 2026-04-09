import { useState } from 'react';
import { motion } from 'framer-motion';
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
import {
  Eye, BarChart3, Award, Globe, CheckCircle2, Rocket,
  TrendingUp, Shield, Zap, ArrowRight, FileText, Download, Star
} from 'lucide-react';

const sponsorSchema = z.object({
  company_name: z.string().trim().min(2, 'Nome da empresa é obrigatório').max(200),
  cnpj: z.string().trim().min(14, 'CNPJ inválido').max(18),
  email: z.string().trim().email('Email inválido').max(255),
  phone: z.string().trim().min(10, 'Telefone inválido').max(20),
  plan: z.enum(['basic', 'pro', 'premium']),
});

type SponsorForm = z.infer<typeof sponsorSchema>;

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' as const },
  }),
};

const benefits = [
  { icon: Eye, title: 'Visibilidade Máxima', desc: 'Sua marca nos melhores espaços da plataforma' },
  { icon: BarChart3, title: 'Relatórios de Performance', desc: 'Métricas de impressões, cliques e CTR em tempo real' },
  { icon: Award, title: 'Banners em Destaque', desc: 'Posições premium no topo, sidebar e conteúdo' },
  { icon: Globe, title: 'Alcance Nacional', desc: 'Segmentação por cidade, categoria ou cobertura total' },
  { icon: Shield, title: 'Garantia de Entrega', desc: 'Plano PRO com impressões garantidas e pacing inteligente' },
  { icon: TrendingUp, title: 'ROI Comprovado', desc: 'Dashboard exclusivo com métricas detalhadas' },
];

const plans = [
  {
    id: 'basic' as const,
    name: 'Básico',
    price: 'R$ 199/mês',
    features: ['1 banner ativo', 'Relatório mensal', 'Suporte por email'],
    color: 'border-muted',
  },
  {
    id: 'pro' as const,
    name: 'PRO',
    price: 'R$ 499/mês',
    features: ['3 banners ativos', 'Impressões garantidas', 'Relatório semanal', 'Pacing inteligente', 'Suporte prioritário'],
    color: 'border-secondary',
    featured: true,
  },
  {
    id: 'premium' as const,
    name: 'Premium',
    price: 'R$ 999/mês',
    features: ['Banners ilimitados', 'Posições exclusivas', 'Relatório diário', 'Gerente dedicado', 'Prioridade máxima'],
    color: 'border-primary',
  },
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

export default function SponsorLandingPage() {
  const [contractAccepted, setContractAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'pro' | 'premium'>('pro');

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
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center max-w-lg"
          >
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-4">Obrigado!</h1>
            <p className="text-lg text-muted-foreground mb-8">
              Seu interesse foi registrado com sucesso. Nossa equipe entrará em contato em até 24 horas úteis.
            </p>
            <Button onClick={() => window.location.href = '/'} size="lg">
              Voltar ao Início
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
      <main className="bg-background">
        {/* Hero */}
        <section className="relative overflow-hidden bg-primary py-20 px-4">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 left-10 w-72 h-72 bg-secondary rounded-full blur-3xl" />
            <div className="absolute bottom-10 right-10 w-96 h-96 bg-white rounded-full blur-3xl" />
          </div>
          <div className="relative max-w-4xl mx-auto text-center">
            <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
              <Badge className="mb-6 bg-secondary text-secondary-foreground text-sm px-4 py-1.5">
                <Rocket className="w-4 h-4 mr-2 inline" />
                Vagas limitadas por região
              </Badge>
            </motion.div>
            <motion.h1
              initial="hidden" animate="visible" variants={fadeUp} custom={1}
              className="text-3xl md:text-5xl font-extrabold text-primary-foreground leading-tight mb-6"
            >
              Seja um Patrocinador e destaque sua marca na maior plataforma de serviços do Brasil!
            </motion.h1>
            <motion.p
              initial="hidden" animate="visible" variants={fadeUp} custom={2}
              className="text-lg md:text-xl text-primary-foreground/80 max-w-2xl mx-auto mb-8"
            >
              Conecte sua marca a milhares de profissionais e clientes. Visibilidade real, métricas comprovadas e ROI garantido.
            </motion.p>
            <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3}>
              <Button
                size="lg"
                variant="secondary"
                className="text-lg px-8 py-6 icon-cta"
                onClick={() => document.getElementById('form-section')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Quero ser Patrocinador <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </motion.div>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-16 px-4 max-w-6xl mx-auto">
          <motion.h2
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
            className="text-2xl md:text-3xl font-bold text-center text-foreground mb-12"
          >
            Por que patrocinar no <span className="text-secondary">Preciso de Um</span>?
          </motion.h2>
          <div className="grid md:grid-cols-3 gap-6">
            {benefits.map((b, i) => (
              <motion.div
                key={b.title}
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeUp} custom={i}
              >
                <Card className="h-full hover:shadow-lg transition-shadow border-t-4 border-t-secondary">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center mb-4">
                      <b.icon className="w-6 h-6 text-secondary" />
                    </div>
                    <h3 className="font-bold text-foreground text-lg mb-2">{b.title}</h3>
                    <p className="text-muted-foreground text-sm">{b.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Plans */}
        <section className="py-16 px-4 bg-muted/50">
          <div className="max-w-5xl mx-auto">
            <motion.h2
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}
              className="text-2xl md:text-3xl font-bold text-center text-foreground mb-12"
            >
              Escolha o plano ideal
            </motion.h2>
            <div className="grid md:grid-cols-3 gap-6">
              {plans.map((plan, i) => (
                <motion.div
                  key={plan.id}
                  initial="hidden" whileInView="visible" viewport={{ once: true }}
                  variants={fadeUp} custom={i}
                >
                  <Card
                    className={`relative h-full cursor-pointer transition-all ${
                      selectedPlan === plan.id
                        ? 'ring-2 ring-secondary shadow-xl scale-[1.02]'
                        : 'hover:shadow-md'
                    } ${plan.featured ? 'border-2 border-secondary' : ''}`}
                    onClick={() => {
                      setSelectedPlan(plan.id);
                      setValue('plan', plan.id);
                    }}
                  >
                    {plan.featured && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-secondary text-secondary-foreground px-3">
                          <Star className="w-3 h-3 mr-1" /> Mais Popular
                        </Badge>
                      </div>
                    )}
                    <CardContent className="p-6 pt-8">
                      <h3 className="text-xl font-bold text-foreground mb-1">{plan.name}</h3>
                      <p className="text-2xl font-extrabold text-primary mb-4">{plan.price}</p>
                      <ul className="space-y-2">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <Zap className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Form */}
        <section id="form-section" className="py-16 px-4 max-w-2xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-2">
              Cadastre-se como Patrocinador
            </h2>
            <p className="text-center text-muted-foreground mb-8">
              Preencha seus dados e nossa equipe entrará em contato
            </p>

            <Card>
              <CardContent className="p-6 md:p-8">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  <div>
                    <Label htmlFor="company_name">Nome da Empresa *</Label>
                    <Input id="company_name" {...register('company_name')} placeholder="Sua empresa" className="mt-1" />
                    {errors.company_name && <p className="text-destructive text-sm mt-1">{errors.company_name.message}</p>}
                  </div>

                  <div>
                    <Label htmlFor="cnpj">CNPJ *</Label>
                    <Input id="cnpj" {...register('cnpj')} placeholder="00.000.000/0000-00" className="mt-1" />
                    {errors.cnpj && <p className="text-destructive text-sm mt-1">{errors.cnpj.message}</p>}
                  </div>

                  <div>
                    <Label htmlFor="email">Email de contato *</Label>
                    <Input id="email" type="email" {...register('email')} placeholder="contato@empresa.com" className="mt-1" />
                    {errors.email && <p className="text-destructive text-sm mt-1">{errors.email.message}</p>}
                  </div>

                  <div>
                    <Label htmlFor="phone">Telefone / WhatsApp *</Label>
                    <Input id="phone" {...register('phone')} placeholder="(41) 99999-9999" className="mt-1" />
                    {errors.phone && <p className="text-destructive text-sm mt-1">{errors.phone.message}</p>}
                  </div>

                  <div>
                    <Label>Plano selecionado</Label>
                    <Select value={selectedPlan} onValueChange={(v: 'basic' | 'pro' | 'premium') => {
                      setSelectedPlan(v);
                      setValue('plan', v);
                    }}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basic">Básico — R$ 199/mês</SelectItem>
                        <SelectItem value="pro">PRO — R$ 499/mês</SelectItem>
                        <SelectItem value="premium">Premium — R$ 999/mês</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Contract acceptance */}
                  <div className="flex items-start gap-3 pt-2">
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
                          <button type="button" className="text-primary underline font-medium hover:text-secondary transition-colors">
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
                              // Close dialog by clicking the close button
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

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full text-lg py-6 icon-cta"
                    disabled={!contractAccepted || submitting}
                  >
                    {submitting ? (
                      'Enviando...'
                    ) : (
                      <>
                        <Rocket className="w-5 h-5 mr-2" />
                        Quero ser Patrocinador
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </section>
      </main>
      <Footer />
    </>
  );
}
