/**
 * SLOTS DE PATROCINADOR — configuração declarativa por página e por cidade.
 *
 * Define, de forma puramente declarativa, quais posições de patrocinador
 * aparecem em cada família de rota, com override opcional por cidade.
 * Não substitui `POSITION_CONFIG` (que descreve o layout de cada posição):
 * aqui definimos ONDE cada posição é exibida e com que prioridade.
 */

import { POSITION_CONFIG } from './sponsorPositions';

export type SponsorPageKind =
  | 'home'
  | 'category'
  | 'city'
  | 'category_city'
  | 'neighborhood'
  | 'search'
  | 'provider'
  | 'content';

export interface SponsorSlot {
  /** Chave em POSITION_CONFIG. */
  position: string;
  /** Ordem de renderização dentro da página (menor primeiro). */
  order: number;
  /** Máximo de itens; default = maxItems da posição. */
  maxItems?: number;
  /** Slot exibido apenas no modo guia comercial. */
  guideOnly?: boolean;
}

export interface CitySlotOverride {
  /** Slots adicionais para a cidade. */
  add?: SponsorSlot[];
  /** Posições removidas para a cidade. */
  remove?: string[];
}

const BASE_SLOTS: Record<SponsorPageKind, SponsorSlot[]> = {
  home: [
    { position: 'hero-top', order: 10 },
    { position: 'featured', order: 20 },
    { position: 'card', order: 30 },
  ],
  category: [
    { position: 'hero-top', order: 10 },
    { position: 'featured', order: 20 },
  ],
  city: [
    { position: 'hero-top', order: 10 },
    { position: 'card', order: 30 },
  ],
  category_city: [
    { position: 'hero-top', order: 10 },
    { position: 'featured', order: 20 },
    { position: 'card', order: 30 },
  ],
  neighborhood: [{ position: 'hero-top', order: 10 }],
  search: [{ position: 'hero-top', order: 10 }],
  provider: [{ position: 'card', order: 30 }],
  content: [{ position: 'card', order: 30 }],
};

/**
 * Overrides por cidade (slug normalizado). Vazio por padrão —
 * preencher conforme contratos de patrocínio locais.
 */
export const CITY_SLOT_OVERRIDES: Record<string, CitySlotOverride> = {};

const normalizeCity = (city?: string | null) =>
  String(city || '')
    .trim()
    .toLowerCase();

/**
 * Resolve os slots de uma página, aplicando override de cidade e o filtro
 * de modo guia. Retorna sempre ordenado e sem posições desconhecidas.
 */
export function resolveSponsorSlots(
  page: SponsorPageKind,
  options?: { citySlug?: string | null; guideMode?: boolean },
): Required<Pick<SponsorSlot, 'position' | 'order' | 'maxItems'>>[] {
  const override = CITY_SLOT_OVERRIDES[normalizeCity(options?.citySlug)];
  const removed = new Set(override?.remove ?? []);

  const merged = [...(BASE_SLOTS[page] ?? []), ...(override?.add ?? [])].filter(
    (slot) => !removed.has(slot.position) && !!POSITION_CONFIG[slot.position],
  );

  const guideMode = !!options?.guideMode;
  const deduped = new Map<string, SponsorSlot>();
  for (const slot of merged) {
    if (slot.guideOnly && !guideMode) continue;
    deduped.set(slot.position, slot);
  }

  return [...deduped.values()]
    .sort((a, b) => a.order - b.order)
    .map((slot) => ({
      position: slot.position,
      order: slot.order,
      maxItems: slot.maxItems ?? POSITION_CONFIG[slot.position].maxItems,
    }));
}

export const SPONSOR_PAGE_KINDS = Object.keys(BASE_SLOTS) as SponsorPageKind[];
