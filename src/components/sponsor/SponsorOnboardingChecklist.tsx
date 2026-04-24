import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2, Circle, Lock, FileText, Image as ImageIcon,
  ShieldCheck, Megaphone, ArrowRight, Sparkles,
} from 'lucide-react';

interface SponsorOnboardingState {
  // Esses sinais vêm do dashboard / sponsor_leads / sponsor_campaigns
  hasCompanyData?: boolean;       // razão social + CNPJ confirmados
  hasCnpjDoc?: boolean;
  hasBanner?: boolean;
  checklistConfirmed?: boolean;
  docsApproved?: boolean;
  docsRejected?: boolean;
  hasActiveCampaign?: boolean;
  leadId?: string | null;
}

interface Step {
  key: string;
  label: string;
  hint: string;
  done: boolean;
  href: string;
  cta: string;
  icon: typeof FileText;
}

interface Props {
  state: SponsorOnboardingState;
  className?: string;
}

/**
 * Checklist progressivo do patrocinador. Avança automaticamente conforme
 * o estado real do lead (sponsor_leads + campanhas) muda.
 * Bloqueia o próximo passo até o anterior estar concluído (ordem correta).
 */
const SponsorOnboardingChecklist = ({ state, className = '' }: Props) => {
  const {
    hasCompanyData,
    hasCnpjDoc,
    hasBanner,
    checklistConfirmed,
    docsApproved,
    docsRejected,
    hasActiveCampaign,
    leadId,
  } = state;

  const steps: Step[] = useMemo(() => [
    {
      key: 'company',
      label: 'Confirme os dados da empresa',
      hint: 'CNPJ, razão social e contato comercial.',
      done: !!hasCompanyData,
      href: '/sponsor-panel/dados',
      cta: 'Revisar dados',
      icon: FileText,
    },
    {
      key: 'cnpj',
      label: 'Anexar comprovante de CNPJ',
      hint: 'PDF ou imagem (até 10MB) — privado e visível só para o admin.',
      done: !!hasCnpjDoc,
      href: leadId ? `/sponsor/status?id=${leadId}` : '/quero-ser-patrocinador',
      cta: 'Enviar CNPJ',
      icon: FileText,
    },
    {
      key: 'banner',
      label: 'Enviar banner do anúncio',
      hint: 'JPG/PNG/WEBP — usado nas vitrines de patrocínio.',
      done: !!hasBanner,
      href: leadId ? `/sponsor/status?id=${leadId}` : '/sponsor-panel/banners',
      cta: 'Enviar banner',
      icon: ImageIcon,
    },
    {
      key: 'checklist',
      label: 'Confirmar checklist final',
      hint: 'Aceite os itens contratuais para iniciar a análise.',
      done: !!checklistConfirmed,
      href: leadId ? `/sponsor/status?id=${leadId}` : '/quero-ser-patrocinador',
      cta: 'Confirmar checklist',
      icon: CheckCircle2,
    },
    {
      key: 'review',
      label: 'Aprovação da equipe',
      hint: docsRejected
        ? 'Documentos rejeitados — corrija e reenvie para nova análise.'
        : docsApproved
          ? 'Tudo aprovado! Próximo passo: ativar campanha.'
          : 'Aguardando análise pelo admin (até 48h úteis).',
      done: !!docsApproved,
      href: leadId ? `/sponsor/status?id=${leadId}` : '/sponsor-panel',
      cta: docsRejected ? 'Ver motivo e reenviar' : 'Acompanhar status',
      icon: ShieldCheck,
    },
    {
      key: 'campaign',
      label: 'Ativar primeira campanha',
      hint: 'Configure segmentação, orçamento e período.',
      done: !!hasActiveCampaign,
      href: '/sponsor-panel/campanhas',
      cta: 'Criar campanha',
      icon: Megaphone,
    },
  ], [hasCompanyData, hasCnpjDoc, hasBanner, checklistConfirmed, docsApproved, docsRejected, hasActiveCampaign, leadId]);

  const total = steps.length;
  const completed = steps.filter(s => s.done).length;
  const pct = Math.round((completed / total) * 100);

  // Próximo passo desbloqueado = primeiro não-feito; demais ficam bloqueados visualmente
  const firstPending = steps.findIndex(s => !s.done);

  if (completed === total) {
    return (
      <Card className={`border-emerald-300 bg-gradient-to-br from-emerald-50 via-card to-primary/5 ${className}`}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-base font-bold text-foreground">
                Onboarding completo!
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Sua conta de patrocinador está 100% ativa e com campanha rodando.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" /> Seu onboarding de patrocinador
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {completed}/{total} concluídos
          </span>
        </CardTitle>
        <Progress value={pct} className="h-2 mt-2" />
      </CardHeader>
      <CardContent className="space-y-2">
        {steps.map((step, idx) => {
          const isCurrent = idx === firstPending;
          const isLocked = idx > firstPending && firstPending !== -1;
          const Icon = step.icon;

          return (
            <motion.div
              key={step.key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              className={`rounded-lg border p-3 flex items-center gap-3 ${
                step.done
                  ? 'border-emerald-200 bg-emerald-50/60'
                  : isCurrent
                    ? 'border-accent/40 bg-accent/5 ring-1 ring-accent/30'
                    : isLocked
                      ? 'border-border bg-muted/20 opacity-60'
                      : 'border-border bg-card'
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  step.done
                    ? 'bg-emerald-500 text-white'
                    : isCurrent
                      ? 'bg-accent text-white'
                      : isLocked
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-muted text-foreground'
                }`}
              >
                {step.done ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : isLocked ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${isLocked ? 'text-muted-foreground' : 'text-foreground'}`}>
                  {step.label}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{step.hint}</p>
              </div>
              {step.done ? (
                <span className="text-[11px] font-semibold text-emerald-700 shrink-0">Feito</span>
              ) : isCurrent ? (
                <Button asChild size="sm" className="shrink-0 gap-1">
                  <Link to={step.href}>
                    {step.cta} <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default SponsorOnboardingChecklist;
