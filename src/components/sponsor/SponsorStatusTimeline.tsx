import { CheckCircle2, Clock, ShieldCheck, XCircle, Upload, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';

interface Props {
  docsStatus: string;                       // pending | submitted | approved | rejected
  createdAt?: string | null;
  docsSubmittedAt?: string | null;
  docsReviewedAt?: string | null;
  reviewNotes?: string | null;
}

type StepKey = 'created' | 'submitted' | 'reviewed' | 'final';

interface Step {
  key: StepKey;
  label: string;
  description: string;
  date: string | null;
  state: 'done' | 'current' | 'pending' | 'failed';
  icon: typeof Clock;
}

/**
 * Linha do tempo visual mostrando os 4 estágios do fluxo de docs do patrocinador.
 * Atualiza em tempo real via props (a página pai assina supabase realtime).
 */
const SponsorStatusTimeline = ({
  docsStatus,
  createdAt,
  docsSubmittedAt,
  docsReviewedAt,
  reviewNotes,
}: Props) => {
  const isApproved = docsStatus === 'approved';
  const isRejected = docsStatus === 'rejected';
  const isSubmitted = docsStatus === 'submitted' || isApproved || isRejected;

  const steps: Step[] = [
    {
      key: 'created',
      label: 'Cadastro criado',
      description: 'Seu interesse foi registrado com sucesso.',
      date: createdAt || null,
      state: 'done',
      icon: CheckCircle2,
    },
    {
      key: 'submitted',
      label: 'Documentos enviados',
      description: isSubmitted
        ? 'Recebemos seus arquivos e o checklist confirmado.'
        : 'Anexe CNPJ/banner e confirme o checklist.',
      date: docsSubmittedAt || null,
      state: isSubmitted ? 'done' : docsStatus === 'pending' ? 'current' : 'pending',
      icon: Upload,
    },
    {
      key: 'reviewed',
      label: 'Em análise pela equipe',
      description: docsReviewedAt
        ? 'Nosso time já revisou seu envio.'
        : isSubmitted
          ? 'Nosso time está revisando agora.'
          : 'Aguardando envio dos documentos.',
      date: docsReviewedAt || null,
      state: docsReviewedAt ? 'done' : isSubmitted ? 'current' : 'pending',
      icon: Eye,
    },
    {
      key: 'final',
      label: isRejected ? 'Necessita correção' : 'Aprovado',
      description: isApproved
        ? 'Tudo certo! Você pode prosseguir com o onboarding.'
        : isRejected
          ? reviewNotes || 'Foram encontrados pontos a corrigir.'
          : 'Aguardando decisão final.',
      date: isApproved || isRejected ? docsReviewedAt || null : null,
      state: isApproved ? 'done' : isRejected ? 'failed' : 'pending',
      icon: isRejected ? XCircle : isApproved ? ShieldCheck : Clock,
    },
  ];

  return (
    <ol className="relative ml-2 space-y-4 border-l-2 border-border pl-6">
      {steps.map((step, idx) => {
        const Icon = step.icon;
        const dotCls =
          step.state === 'done'
            ? 'bg-emerald-500 text-white border-emerald-500'
            : step.state === 'current'
              ? 'bg-amber-400 text-amber-950 border-amber-400 animate-pulse'
              : step.state === 'failed'
                ? 'bg-red-500 text-white border-red-500'
                : 'bg-muted text-muted-foreground border-border';
        const titleCls =
          step.state === 'done'
            ? 'text-emerald-700'
            : step.state === 'current'
              ? 'text-amber-700'
              : step.state === 'failed'
                ? 'text-red-700'
                : 'text-muted-foreground';

        return (
          <motion.li
            key={step.key}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.06 }}
            className="relative"
          >
            <span
              className={`absolute -left-[34px] top-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 ${dotCls}`}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <p className={`text-sm font-semibold ${titleCls}`}>{step.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
            {step.date && (
              <p className="text-[11px] text-muted-foreground/80 mt-1">
                {format(new Date(step.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            )}
          </motion.li>
        );
      })}
    </ol>
  );
};

export default SponsorStatusTimeline;
