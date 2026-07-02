import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  FileText, CheckCircle2, Download, Shield, Calendar,
  Building2, Hash, ArrowRight
} from 'lucide-react';

const planLabels: Record<string, string> = {
  basic: 'Básico',
  pro: 'PRO',
  premium: 'Premium',
};

const today = new Date().toLocaleDateString('pt-BR', {
  day: '2-digit', month: 'long', year: 'numeric',
});

interface ContractProps {
  companyName: string;
  cnpj: string;
  plan: string;
}

function ContractDocument({ companyName, cnpj, plan }: ContractProps) {
  const planLabel = planLabels[plan] || plan;

  return (
    <div className="prose prose-sm max-w-none text-foreground dark:prose-invert">
      <div className="text-center mb-8">
        <h2 className="text-xl font-bold mb-1">CONTRATO DE PATROCÍNIO</h2>
        <p className="text-muted-foreground text-sm">Plataforma Preciso de Um</p>
        <Separator className="my-4" />
      </div>

      <p className="text-sm text-muted-foreground mb-4">Data: {today}</p>

      <div className="bg-muted/50 rounded-lg p-4 mb-6 space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <Building2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div>
            <strong>Plataforma:</strong> Preciso de Um, representada por Ping Soluções LTDA,
            CNPJ XX.XXX.XXX/XXXX-XX, doravante denominada &quot;Plataforma&quot;.
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Building2 className="w-4 h-4 text-secondary mt-0.5 shrink-0" />
          <div>
            <strong>Patrocinador:</strong>{' '}
            {companyName || <em className="text-muted-foreground">[Nome da empresa]</em>},
            CNPJ {cnpj || <em className="text-muted-foreground">[CNPJ]</em>},
            doravante denominado &quot;Patrocinador&quot;.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Hash className="w-4 h-4 text-accent-foreground shrink-0" />
          <div>
            <strong>Plano contratado:</strong>{' '}
            <Badge variant="outline">{planLabel}</Badge>
          </div>
        </div>
      </div>

      <h3 className="text-base font-bold mt-6 mb-2">1. OBJETO</h3>
      <p>
        O presente contrato tem como objeto o patrocínio do Patrocinador na Plataforma
        &quot;Preciso de Um&quot;, garantindo a veiculação de anúncios, banners e outros
        materiais de marketing conforme o plano <strong>{planLabel}</strong> contratado.
      </p>

      <h3 className="text-base font-bold mt-6 mb-2">2. PLANOS E CONDIÇÕES</h3>
      <ol className="list-decimal ml-4 space-y-1">
        <li>
          O Patrocinador escolhe o plano <strong>{planLabel}</strong>,
          com duração mensal ou anual, conforme acordo comercial.
        </li>
        <li>
          Os valores e formas de pagamento estão detalhados na proposta comercial
          vinculada a este contrato.
        </li>
        <li>
          O patrocínio garante exposição no(s) espaço(s) contratado(s),
          respeitando o limite de impressões e a segmentação definida.
        </li>
        {plan === 'pro' && (
          <li>
            O plano PRO inclui <strong>impressões garantidas</strong> com
            pacing inteligente e compensação automática em caso de under-delivery.
          </li>
        )}
        {plan === 'premium' && (
          <li>
            O plano Premium inclui <strong>posições exclusivas</strong>,
            gerente dedicado e relatórios diários de performance.
          </li>
        )}
      </ol>

      <h3 className="text-base font-bold mt-6 mb-2">3. OBRIGAÇÕES DA PLATAFORMA</h3>
      <ol className="list-decimal ml-4 space-y-1">
        <li>Veicular os anúncios do Patrocinador conforme plano contratado.</li>
        <li>Garantir relatórios de impressões e desempenho, quando aplicável.</li>
        <li>
          Manter o conteúdo da Plataforma em conformidade com normas legais,
          evitando qualquer uso prejudicial à imagem do Patrocinador.
        </li>
        <li>
          Fornecer acesso ao painel de métricas com dados de impressões, cliques e CTR.
        </li>
      </ol>

      <h3 className="text-base font-bold mt-6 mb-2">4. OBRIGAÇÕES DO PATROCINADOR</h3>
      <ol className="list-decimal ml-4 space-y-1">
        <li>
          Fornecer conteúdo correto, atualizado e legalmente permitido para veiculação.
        </li>
        <li>Pagar pontualmente os valores acordados no plano escolhido.</li>
        <li>
          Não divulgar conteúdo ofensivo, ilegal ou que viole direitos de terceiros.
        </li>
        <li>
          Respeitar as diretrizes técnicas de banners e materiais visuais
          disponibilizadas pela Plataforma.
        </li>
      </ol>

      <h3 className="text-base font-bold mt-6 mb-2">5. VIGÊNCIA E RESCISÃO</h3>
      <p>
        Este contrato terá vigência conforme o plano escolhido, podendo ser rescindido
        por qualquer das partes mediante aviso prévio de <strong>30 (trinta) dias</strong>.
        A rescisão não isenta o pagamento das obrigações pendentes até a data efetiva
        do encerramento.
      </p>

      <h3 className="text-base font-bold mt-6 mb-2">6. GARANTIAS E LIMITAÇÕES</h3>
      <p>
        A Plataforma não se responsabiliza por resultados de vendas ou conversões
        gerados pelos anúncios. Eventuais problemas técnicos serão corrigidos
        sem prejuízo ao Patrocinador, incluindo compensação proporcional de
        impressões quando aplicável ao plano contratado.
      </p>

      <h3 className="text-base font-bold mt-6 mb-2">7. DISPOSIÇÕES GERAIS</h3>
      <ol className="list-decimal ml-4 space-y-1">
        <li>
          O presente contrato não estabelece sociedade, vínculo empregatício ou
          parceria jurídica entre as partes além do patrocínio.
        </li>
        <li>
          Qualquer alteração neste contrato deve ser formalizada por escrito
          e aprovada por ambas as partes.
        </li>
        <li>
          As partes elegem o foro da Comarca de <strong>Curitiba/PR</strong> para
          dirimir quaisquer controvérsias oriundas deste instrumento.
        </li>
      </ol>

      <Separator className="my-8" />

      <div className="flex flex-col md:flex-row justify-between gap-8 mt-8">
        <div className="text-center">
          <div className="border-t border-foreground/30 w-48 mx-auto mb-2" />
          <p className="text-sm font-medium">Plataforma &quot;Preciso de Um&quot;</p>
          <p className="text-xs text-muted-foreground">Ping Soluções LTDA</p>
        </div>
        <div className="text-center">
          <div className="border-t border-foreground/30 w-48 mx-auto mb-2" />
          <p className="text-sm font-medium">{companyName || 'Patrocinador'}</p>
          <p className="text-xs text-muted-foreground">{cnpj || 'CNPJ'}</p>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-8">
        © 2026 Preciso de Um — Todos os direitos reservados
      </p>
    </div>
  );
}

export default function SponsorContractPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const contractRef = useRef<HTMLDivElement>(null);

  const companyName = searchParams.get('empresa') || '';
  const cnpj = searchParams.get('cnpj') || '';
  const plan = searchParams.get('plano') || 'pro';
  const leadId = searchParams.get('lead') || '';

  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleConfirm = async () => {
    if (!accepted) return;
    setSubmitting(true);
    try {
      // Update sponsor_leads if lead ID provided
      if (leadId) {
        await supabase
          .from('sponsor_leads' as any)
          .update({
            contract_accepted: true,
            status: 'contract_signed',
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', leadId);
      }
      setConfirmed(true);
      toast.success('Contrato aceito com sucesso!');
    } catch {
      toast.error('Erro ao registrar aceite. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPdf = () => {
    // Generate a text version for download
    const text = `CONTRATO DE PATROCÍNIO — Preciso de Um
Data: ${today}

PLATAFORMA: Preciso de Um — Ping Soluções LTDA
PATROCINADOR: ${companyName || '[Nome da empresa]'} — CNPJ: ${cnpj || '[CNPJ]'}
PLANO: ${planLabels[plan] || plan}

1. OBJETO
O presente contrato tem como objeto o patrocínio do Patrocinador na Plataforma "Preciso de Um", garantindo a veiculação de anúncios, banners e outros materiais de marketing conforme o plano contratado.

2. PLANOS E CONDIÇÕES
2.1 O Patrocinador escolhe o plano ${planLabels[plan] || plan}, com duração mensal ou anual.
2.2 Os valores e formas de pagamento estão detalhados na proposta comercial.
2.3 O patrocínio garante exposição no(s) espaço(s) contratado(s), respeitando o limite de impressões e a segmentação definida.

3. OBRIGAÇÕES DA PLATAFORMA
3.1 Veicular os anúncios do Patrocinador conforme plano contratado.
3.2 Garantir relatórios de impressões e desempenho.
3.3 Manter o conteúdo em conformidade com normas legais.
3.4 Fornecer acesso ao painel de métricas.

4. OBRIGAÇÕES DO PATROCINADOR
4.1 Fornecer conteúdo correto, atualizado e legalmente permitido.
4.2 Pagar pontualmente os valores acordados.
4.3 Não divulgar conteúdo ofensivo, ilegal ou que viole direitos de terceiros.
4.4 Respeitar as diretrizes técnicas de banners.

5. VIGÊNCIA E RESCISÃO
Vigência conforme o plano escolhido. Rescisão mediante aviso prévio de 30 dias. A rescisão não isenta obrigações pendentes.

6. GARANTIAS E LIMITAÇÕES
A Plataforma não se responsabiliza por resultados de vendas ou conversões. Problemas técnicos serão corrigidos sem prejuízo.

7. DISPOSIÇÕES GERAIS
7.1 Não estabelece sociedade, vínculo empregatício ou parceria jurídica.
7.2 Alterações devem ser formalizadas por escrito.
7.3 Foro: Comarca de Curitiba/PR.

© 2026 Preciso de Um — Todos os direitos reservados
`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Contrato_Patrocinio_${companyName || 'PrecisodeUm'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (confirmed) {
    return (
      <>
        <Header />
        <main className="min-h-screen flex items-center justify-center bg-background px-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center max-w-lg"
          >
            <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-accent" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-4">Contrato Aceito!</h1>
            <p className="text-lg text-muted-foreground mb-3">
              Obrigado, <strong>{companyName || 'Patrocinador'}</strong>!
              Seu aceite foi registrado com sucesso.
            </p>
            <p className="text-muted-foreground mb-8">
              Nossa equipe entrará em contato para os próximos passos.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Button variant="outline" onClick={handleDownloadPdf}>
                <Download className="w-4 h-4 mr-2" /> Baixar contrato
              </Button>
              <Button onClick={() => navigate('/')}>
                Voltar ao Início
              </Button>
            </div>
          </motion.div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="bg-background py-12 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Page header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              Contrato de Patrocínio
            </h1>
            <p className="text-muted-foreground">
              Leia atentamente as cláusulas abaixo e confirme seu aceite
            </p>
          </motion.div>

          {/* Info chips */}
          {(companyName || plan) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex flex-wrap gap-2 justify-center mb-6"
            >
              {companyName && (
                <Badge variant="outline" className="gap-1.5 py-1.5 px-3">
                  <Building2 className="w-3.5 h-3.5" /> {companyName}
                </Badge>
              )}
              {cnpj && (
                <Badge variant="outline" className="gap-1.5 py-1.5 px-3">
                  <Hash className="w-3.5 h-3.5" /> {cnpj}
                </Badge>
              )}
              <Badge className="bg-secondary text-secondary-foreground gap-1.5 py-1.5 px-3">
                <Shield className="w-3.5 h-3.5" /> Plano {planLabels[plan] || plan}
              </Badge>
              <Badge variant="outline" className="gap-1.5 py-1.5 px-3">
                <Calendar className="w-3.5 h-3.5" /> {today}
              </Badge>
            </motion.div>
          )}

          {/* Contract body */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="shadow-lg">
              <CardContent className="p-0">
                <div
                  ref={contractRef}
                  className="max-h-[500px] overflow-y-auto p-6 md:p-8 scroll-smooth"
                >
                  <ContractDocument
                    companyName={companyName}
                    cnpj={cnpj}
                    plan={plan}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Accept + Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6 space-y-4"
          >
            <div className="flex items-start gap-3 bg-muted/50 rounded-lg p-4">
              <Checkbox
                id="accept-contract"
                checked={accepted}
                onCheckedChange={(v) => setAccepted(v === true)}
                className="mt-0.5"
              />
              <label
                htmlFor="accept-contract"
                className="text-sm text-foreground leading-snug cursor-pointer"
              >
                Li e aceito integralmente todas as cláusulas deste Contrato de Patrocínio,
                concordando com as obrigações, condições e disposições nele contidas.
              </label>
            </div>

            <div className="flex flex-wrap gap-3 justify-between">
              <Button variant="outline" onClick={handleDownloadPdf} size="sm">
                <Download className="w-4 h-4 mr-2" /> Baixar Contrato
              </Button>

              <Button
                size="lg"
                disabled={!accepted || submitting}
                onClick={handleConfirm}
                className="px-8"
              >
                {submitting ? (
                  'Registrando...'
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    Confirmar Patrocínio
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      </main>
      <Footer />
    </>
  );
}
