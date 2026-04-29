/**
 * HelpOnboardingPage — FAQ específico do onboarding/cadastro com:
 *  - CTA principal de WhatsApp do suporte (5541997452053).
 *  - 8 perguntas frequentes sobre dúvidas comuns do wizard.
 *  - Links para central de ajuda e voltar ao cadastro.
 *
 * Objetivo: aumentar conversão sem depender só do exit-intent — usuário pode
 * entrar aqui via link no próprio pop-up ou pelo footer/navegação.
 */
import { Link } from 'react-router-dom';
import { ArrowLeft, MessageCircle, HelpCircle, Mail, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useSeoHead, SITE_BASE_URL } from '@/hooks/useSeoHead';

const SUPPORT_WHATSAPP = '5541997452053';
const SUPPORT_DISPLAY = '(41) 99745-2053';
const SUPPORT_EMAIL = 'suporte@precisodeumprofissional.com.br';
const WHATSAPP_MSG = encodeURIComponent(
  'Olá! Vi a página de ajuda do cadastro em precisodeumprofissional.com.br e gostaria de suporte para finalizar meu perfil.',
);

const faq = [
  {
    q: 'Quanto tempo leva para concluir meu cadastro?',
    a: 'A maioria dos profissionais leva entre 2 e 5 minutos. Você pode pausar e voltar — o progresso fica salvo automaticamente.',
  },
  {
    q: 'Preciso pagar alguma coisa?',
    a: 'Não. O cadastro é 100% gratuito para profissionais. Não cobramos comissão por contato e não há taxa para aparecer na busca.',
  },
  {
    q: 'CPF e CNPJ são obrigatórios?',
    a: 'Não. CPF/CNPJ é opcional para finalizar o cadastro. Quem preenche ganha um selo de confiança extra, mas não é obrigatório para começar a receber contatos.',
  },
  {
    q: 'Por que pedem WhatsApp?',
    a: 'O WhatsApp é o canal principal pelo qual seus clientes vão te procurar. Ele aparece como botão direto no seu perfil público e nunca é compartilhado para terceiros.',
  },
  {
    q: 'Não consigo encontrar minha cidade no campo de localização',
    a: 'Use a sugestão automática (digite 3 letras e aguarde). Se mesmo assim não aparecer, envie um WhatsApp pro suporte com o nome da cidade e o estado — adicionamos manualmente.',
  },
  {
    q: 'Travei em alguma etapa do cadastro. O que fazer?',
    a: 'Toque no botão "Voltar" no topo da página para revisar o passo anterior. Se o erro persistir, fale com o suporte pelo WhatsApp — finalizamos o cadastro com você.',
  },
  {
    q: 'Posso cadastrar mais de um serviço?',
    a: 'Sim. Após o primeiro serviço, o wizard te leva para a etapa de "mais serviços" e portfólio. Quanto mais completo o perfil, maior a visibilidade na busca.',
  },
  {
    q: 'Como entro em contato se preciso de ajuda agora?',
    a: 'O canal mais rápido é o WhatsApp. Resposta em poucos minutos no horário comercial.',
  },
];

export default function HelpOnboardingPage() {
  const waUrl = `https://wa.me/${SUPPORT_WHATSAPP}?text=${WHATSAPP_MSG}`;
  useSeoHead({
    title: 'Ajuda do Cadastro – Preciso de um Profissional',
    description:
      'Tire suas dúvidas sobre o cadastro de profissional na Preciso de um Profissional. Suporte direto pelo WhatsApp.',
    canonical: `${SITE_BASE_URL}/ajuda/cadastro`,
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-amber-50/20 dark:to-amber-950/10">
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <Link
          to="/cadastro-inicial"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao cadastro
        </Link>

        <header className="mb-6">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            <HelpCircle className="h-5 w-5" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Ajuda do cadastro
          </h1>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            Dúvidas frequentes para concluir seu cadastro de profissional. Se preferir, fale com o
            suporte agora pelo WhatsApp e finalizamos com você.
          </p>
        </header>

        <Card className="mb-6 border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Suporte direto pelo WhatsApp</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Resposta rápida no horário comercial. Atendimento humano.
              </p>
            </div>
            <Button
              asChild
              className="gap-2 bg-gradient-to-r from-emerald-500 to-green-600 font-semibold text-white shadow-[0_8px_24px_-8px_rgba(16,185,129,0.6)] hover:opacity-95"
            >
              <a href={waUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" />
                Falar no WhatsApp
              </a>
            </Button>
          </CardContent>
        </Card>

        <Accordion type="single" collapsible className="mb-8 rounded-xl border bg-card">
          {faq.map((item, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="px-4">
              <AccordionTrigger className="text-left text-sm font-semibold">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-foreground">Outros canais de contato</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4" /> WhatsApp: {SUPPORT_DISPLAY}
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <a className="hover:text-foreground" href={`mailto:${SUPPORT_EMAIL}`}>
                  {SUPPORT_EMAIL}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4" />
                <Link to="/ajuda" className="hover:text-foreground">
                  Central de ajuda completa
                </Link>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
