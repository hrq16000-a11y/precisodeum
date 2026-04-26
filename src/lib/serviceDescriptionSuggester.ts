/**
 * Sugestão de descrição inicial para o 1º serviço, a partir da categoria escolhida.
 *
 * Estratégia 100% local (zero custo):
 *   1. Tenta casar o slug da categoria com SERVICE_TEMPLATES (src/data/serviceTemplates.ts)
 *      e pega a primeira variação rica.
 *   2. Fallback: gera uma descrição genérica e profissional usando o nome da categoria
 *      e (opcional) a cidade do prestador para reforço local/SEO.
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
}

const FALLBACK = (name: string, city?: string | null) =>
  `Sou profissional de ${name.toLowerCase()}${city ? ` atendendo em ${city}` : ''}. ` +
  `Trabalho com qualidade, pontualidade e atenção aos detalhes, garantindo o melhor resultado para cada cliente. ` +
  `Entre em contato pelo WhatsApp para combinarmos os detalhes do seu serviço.`;

export function suggestServiceDescription(input: SuggestDescriptionInput): string {
  const name = (input.categoryName || '').trim();
  if (!name) return '';

  const slug = (input.categorySlug || sanitizeSlug(name)).trim();
  const variants = SERVICE_TEMPLATES[slug];
  if (variants && variants.length > 0) {
    // Pega a primeira variante mais "completa" (descrições já redigidas profissionalmente).
    return variants[0].description;
  }

  return FALLBACK(name, input.city);
}
