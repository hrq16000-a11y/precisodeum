/**
 * GoldChecklist — Checklist dinâmico exibido na Revisão Final do wizard.
 *
 * Lista cada critério do "Padrão Ouro" (computeAdScore.breakdown) em
 * ordem de impacto e indica claramente o que ainda falta para chegar a
 * 100%. Quando todos os critérios estão atendidos, parabeniza e libera
 * a publicação com o selo de Padrão Ouro.
 *
 * Não duplica a barra (essa fica em AdQualityScore) — foco aqui é
 * acionável: cada item pendente vira um TODO claro com a quantidade de
 * pontos que ele desbloqueia.
 */

import { CheckCircle2, Circle, Award, ArrowUp } from 'lucide-react';
import { computeAdScore, type AdScoreInput } from '@/lib/serviceQualityLinter';

interface Props extends AdScoreInput {
  /** Se true, esconde o card quando todos os critérios estão OK. */
  hideWhenComplete?: boolean;
}

const HINTS: Record<string, string> = {
  city: 'Volte à etapa 2 e selecione uma cidade do catálogo IBGE.',
  description: 'Acrescente detalhes técnicos, materiais e processo do serviço (mínimo 300 caracteres).',
  keywords: 'Inclua termos técnicos da sua categoria (ex.: "disjuntor", "fiação", "quadro elétrico").',
  photo: 'Adicione pelo menos uma foto original do seu trabalho na etapa 3.',
  noForbidden: 'Use o botão "Reescrever com qualidade" para remover termos de leilão.',
};

export default function GoldChecklist(props: Props) {
  const { hideWhenComplete = false, ...input } = props;
  const result = computeAdScore(input);
  const { score, breakdown, isPadrãoOuro } = result;
  const missing = breakdown.filter((b) => !b.reached);
  const pointsToGo = 100 - score;

  if (isPadrãoOuro && hideWhenComplete) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Award className={`h-4 w-4 ${isPadrãoOuro ? 'text-amber-500' : 'text-muted-foreground'}`} />
          <h4 className="text-xs font-semibold text-foreground">
            {isPadrãoOuro ? 'Padrão Ouro alcançado!' : 'Falta para o Padrão Ouro'}
          </h4>
        </div>
        {!isPadrãoOuro && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-accent">
            <ArrowUp className="h-3 w-3" /> +{pointsToGo} pts
          </span>
        )}
      </div>

      {isPadrãoOuro ? (
        <p className="text-[11px] text-muted-foreground">
          Todos os critérios atendidos. Seu anúncio está pronto para o topo das buscas.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {missing.map((b) => (
            <li key={b.key} className="flex items-start gap-2 text-[11px]">
              <Circle className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-foreground">
                  {b.label}
                  <span className="ml-1 text-muted-foreground font-normal">(+{b.value} pts)</span>
                </p>
                <p className="text-muted-foreground leading-snug">{HINTS[b.key] || ''}</p>
              </div>
            </li>
          ))}
          {breakdown.filter((b) => b.reached).map((b) => (
            <li key={b.key} className="flex items-start gap-2 text-[11px] opacity-70">
              <CheckCircle2 className="h-3 w-3 text-emerald-600 mt-0.5 shrink-0" />
              <span className="text-muted-foreground line-through">{b.label}</span>
              <span className="ml-auto text-[10px] text-emerald-700 font-semibold">+{b.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
