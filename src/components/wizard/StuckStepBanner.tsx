/**
 * StuckStepBanner — Mensagem clara quando o usuário está preso em uma etapa
 * por causa de dados faltantes, oferecendo um caminho de correção visível.
 *
 * Não bloqueia: apenas guia. Aparece somente quando `missing` tem itens.
 */
import { AlertCircle, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/router-compat';

interface StuckStepBannerProps {
  /** Lista de campos faltantes (ex: ["Categoria", "Cidade"]). */
  missing: string[];
  /** Slug curto da etapa para o status do cadastro. */
  stepLabel?: string;
  /** Ação principal (se quiser sobrescrever o link de status). */
  actionHref?: string;
  actionLabel?: string;
  /** Mostra o link "Ver status do cadastro" (default: true). */
  showStatusLink?: boolean;
}

export const StuckStepBanner = ({
  missing,
  stepLabel,
  actionHref,
  actionLabel,
  showStatusLink = true,
}: StuckStepBannerProps) => {
  if (!missing || missing.length === 0) return null;

  return (
    <Card className="border-amber-400/50 bg-amber-50/60 p-3 dark:bg-amber-500/5">
      <div className="flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
            Falta pouco para avançar{stepLabel ? ` — ${stepLabel}` : ''}
          </p>
          <p className="mt-0.5 text-[11px] text-amber-800/90 dark:text-amber-200/90">
            Para concluir esta etapa, preencha:{' '}
            <strong>{missing.join(', ')}</strong>.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {actionHref && (
              <Button asChild size="sm" variant="default" className="h-7 text-[11px]">
                <Link to={actionHref}>
                  {actionLabel || 'Corrigir agora'}
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            )}
            {showStatusLink && (
              <Button asChild size="sm" variant="outline" className="h-7 text-[11px]">
                <Link to="/dashboard/cadastro-status">Ver status do cadastro</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default StuckStepBanner;
