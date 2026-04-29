/**
 * AdLivePreview — Prévia em tempo real do anúncio enquanto o prestador
 * preenche o wizard. Mostra como o card vai aparecer nas buscas
 * (título, descrição truncada, palavras-chave da categoria detectadas
 * e localização) e exibe o score atual com cor semântica.
 *
 * 100% UI presentational — não persiste nada e usa apenas o que já
 * está no formulário + helpers existentes.
 */

import { Eye, MapPin, Tag, Sparkles } from 'lucide-react';
import { computeAdScore } from '@/lib/serviceQualityLinter';
import { detectCategoryKeywords } from '@/lib/categoryKeywords';

interface Props {
  title: string;
  description: string;
  city: string;
  cityValidated: boolean;
  hasOriginalPhoto: boolean;
  categoryName?: string | null;
  categorySlugs: string[];
}

function postureFromScore(score: number): { label: string; color: string; ring: string } {
  if (score >= 71) return { label: 'Anúncio Profissional · pronto para o Google', color: 'text-emerald-700 dark:text-emerald-300', ring: 'ring-emerald-400/40' };
  if (score >= 41) return { label: 'Anúncio Bom · pode melhorar para destacar', color: 'text-amber-700 dark:text-amber-300', ring: 'ring-amber-400/40' };
  return { label: 'Anúncio Fraco · poucas chances de busca', color: 'text-destructive', ring: 'ring-destructive/40' };
}

export default function AdLivePreview({
  title,
  description,
  city,
  cityValidated,
  hasOriginalPhoto,
  categoryName,
  categorySlugs,
}: Props) {
  const { score } = computeAdScore({
    description,
    hasOriginalPhoto,
    cityValidated,
    categorySlugs,
  });
  const posture = postureFromScore(score);
  const { matched } = detectCategoryKeywords(description, categorySlugs);

  const safeTitle = title.trim() || 'Título do seu serviço aparecerá aqui';
  const safeDesc = description.trim() || 'A descrição que você escrever aparece aqui — capriche em detalhes técnicos para subir o score.';
  const safeCity = city.trim() || 'Selecione sua cidade';

  return (
    <div className={`rounded-lg border bg-background p-3 space-y-2 ring-1 ${posture.ring}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Eye className="h-3 w-3" /> Prévia ao vivo
        </span>
        <span className={`text-[10px] font-bold ${posture.color}`}>{posture.label}</span>
      </div>

      {/* Mock card como aparece nas buscas */}
      <div className="rounded-md border border-border bg-card p-2.5 space-y-1.5">
        <div className="flex items-start gap-2">
          <div className={`h-10 w-10 shrink-0 rounded-md flex items-center justify-center text-[10px] font-semibold ${
            hasOriginalPhoto ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
          }`}>
            {hasOriginalPhoto ? 'FOTO' : 'sem foto'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate" title={safeTitle}>
              {safeTitle}
            </p>
            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-snug">
              {safeDesc}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {safeCity}
            {cityValidated && <span className="text-emerald-600">✓</span>}
          </span>
          {categoryName && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Tag className="h-3 w-3" />
              {categoryName}
            </span>
          )}
        </div>

        {matched.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-accent">
              <Sparkles className="h-3 w-3" /> Palavras-chave:
            </span>
            {matched.slice(0, 6).map((k) => (
              <span key={k} className="inline-flex items-center rounded-full bg-accent/10 text-accent px-1.5 py-0.5 text-[10px]">
                {k}
              </span>
            ))}
            {matched.length > 6 && (
              <span className="text-[10px] text-muted-foreground">+{matched.length - 6}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
