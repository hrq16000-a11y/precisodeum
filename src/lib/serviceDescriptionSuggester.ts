/**
 * Sugestão de descrição inicial para o 1º serviço, a partir da categoria escolhida.
 *
 * Estratégia 100% local (zero custo):
 *   1. Tenta casar o slug da categoria com SERVICE_TEMPLATES (src/data/serviceTemplates.ts)
 *      e usa as variações ricas como base.
 *   2. Fallback: gera descrições genéricas profissionais a partir do nome da
 *      categoria e (opcional) da cidade/bairro do prestador para reforço local/SEO.
 *
 * A descrição sugerida é sempre devolvida como string editável — o componente
 * Phase2Service injeta no textarea, deixando o usuário ajustar antes de salvar.
 */

import { SERVICE_TEMPLATES } from '@/data/serviceTemplates';
import { sanitizeSlug } from '@/lib/slugify';

export interface SuggestDescriptionInput {
  categoryName: string;
  categorySlug?: string | null;
  city?: string | null;
  neighborhood?: string | null;
}

const buildLocale = (city?: string | null, neighborhood?: string | null): string => {
  const c = (city || '').trim();
  const b = (neighborhood || '').trim();
  if (b && c) return `${b}, ${c}`;
  if (c) return c;
  if (b) return b;
  return '';
};

const FALLBACK = (name: string, locale: string) =>
  `Sou profissional de ${name.toLowerCase()}${locale ? ` atendendo em ${locale}` : ''}. ` +
  `Trabalho com qualidade, pontualidade e atenção aos detalhes, garantindo o melhor resultado para cada cliente. ` +
  `Entre em contato pelo WhatsApp para combinarmos os detalhes do seu serviço.`;

const FALLBACK_VARIANTS = (name: string, locale: string): string[] => {
  const lower = name.toLowerCase();
  const here = locale ? ` em ${locale}` : '';
  return [
    FALLBACK(name, locale),
    `Atuo como ${lower}${here} com foco em qualidade, prazos curtos e relacionamento próximo. ` +
      `Faço orçamento sem compromisso e atendo tanto pequenas demandas quanto projetos completos. ` +
      `Chame no WhatsApp para combinarmos.`,
    `Profissional de ${lower}${here} com experiência prática e ferramentas adequadas para cada serviço. ` +
      `Compromisso com pontualidade, organização e acabamento bem feito. ` +
      `Solicite seu atendimento pelo WhatsApp.`,
  ];
};

const enrichWithLocale = (text: string, locale: string): string => {
  if (!locale) return text;
  // Se a descrição-base não menciona localização explícita, anexa frase curta de SEO local.
  const lower = text.toLowerCase();
  if (lower.includes(locale.toLowerCase())) return text;
  return `${text} Atendimento em ${locale}.`;
};

/** Mantém compatibilidade — retorna apenas a 1ª variante. */
export function suggestServiceDescription(input: SuggestDescriptionInput): string {
  const list = suggestServiceDescriptionVariants(input);
  return list[0] || '';
}

/**
 * Gera até 3 variantes de descrição para o usuário escolher.
 * - Quando há templates da categoria: usa até 3 variações distintas.
 * - Quando não há: usa 3 estilos diferentes do fallback.
 * - Sempre enriquecido com cidade/bairro (se disponível) sem duplicar.
 */
export function suggestServiceDescriptionVariants(input: SuggestDescriptionInput): string[] {
  const name = (input.categoryName || '').trim();
  if (!name) return [];

  const slug = (input.categorySlug || sanitizeSlug(name)).trim();
  const locale = buildLocale(input.city, input.neighborhood);
  const variants = SERVICE_TEMPLATES[slug];

  if (variants && variants.length > 0) {
    const picks = variants.slice(0, 3).map(v => enrichWithLocale(v.description, locale));
    // Garante 3 itens (completa com fallback se a categoria tiver menos de 3 templates)
    while (picks.length < 3) {
      const idx = picks.length;
      picks.push(FALLBACK_VARIANTS(name, locale)[idx] || FALLBACK(name, locale));
    }
    return picks;
  }

  return FALLBACK_VARIANTS(name, locale);
}
