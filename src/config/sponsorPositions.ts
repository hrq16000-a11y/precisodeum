import {
  PanelTop, Crown, Columns, Monitor, Star, Zap,
  type LucideIcon,
} from 'lucide-react';
// NOTE: lucide "Image" conflicts with the global Image type, import as ImageIcon where needed
import { Image as ImageIcon } from 'lucide-react';

export type SponsorLayout = 'banner' | 'card-grid' | 'carousel' | 'vertical' | 'card';

export interface PositionEntry {
  /** Human-readable label */
  label: string;
  /** Tooltip description — where the slot appears */
  description: string;
  /** Visual layout type */
  layout: SponsorLayout;
  /** Maximum items to display simultaneously */
  maxItems: number;
  /** Recommended dimensions string (shown in admin) */
  dimensions: string;
  /** If true, sponsors without image_url AND logo_url are filtered out */
  requiresImage: boolean;
  /** Lucide icon component for admin UI */
  icon: LucideIcon;
  /** Tailwind text-color class for admin badges */
  color: string;
}

/**
 * Single source of truth for all sponsor positions.
 * Used by both the frontend hooks and the admin panel.
 */
export const POSITION_CONFIG: Record<string, PositionEntry> = {
  'hero-top': {
    label: 'Leader (Topo)',
    description: 'Faixa LeaderSponsor no topo (home, categoria, cidade)',
    layout: 'banner',
    maxItems: 3,
    dimensions: '1600×200 px (8:1)',
    requiresImage: true,
    icon: PanelTop,
    color: 'text-red-500',
  },
  featured: {
    label: 'Destaque Premium',
    description: 'Cards de destaque premium (topo de páginas)',
    layout: 'card-grid',
    maxItems: 3,
    dimensions: 'Card premium',
    requiresImage: true,
    icon: Crown,
    color: 'text-orange-500',
  },
  card: {
    label: 'Parceiros (Grid)',
    description: 'Seção "Parceiros & Patrocinadores" (grid de cards)',
    layout: 'card-grid',
    maxItems: 6,
    dimensions: '600×400 px (5:3)',
    requiresImage: true,
    icon: ImageIcon,
    color: 'text-indigo-500',
  },
  banner: {
    label: 'Banner Interno',
    description: 'Banner 8:1 em páginas internas (busca, vagas, blog)',
    layout: 'banner',
    maxItems: 3,
    dimensions: '1600×200 px (8:1)',
    requiresImage: true,
    icon: PanelTop,
    color: 'text-green-500',
  },
  'between-sections': {
    label: 'Entre Seções',
    description: 'Entre seções da homepage',
    layout: 'banner',
    maxItems: 2,
    dimensions: '1600×200 px (8:1)',
    requiresImage: true,
    icon: Columns,
    color: 'text-blue-500',
  },
  'mid-content': {
    label: 'Meio de Conteúdo',
    description: 'Cards entre listagens de conteúdo',
    layout: 'card-grid',
    maxItems: 2,
    dimensions: 'Card inline',
    requiresImage: true,
    icon: Monitor,
    color: 'text-purple-500',
  },
  showcase: {
    label: 'Showcase (Carrossel)',
    description: 'Carrossel de destaques na home',
    layout: 'carousel',
    maxItems: 6,
    dimensions: '600×450 px (4:3)',
    requiresImage: true,
    icon: Star,
    color: 'text-amber-500',
  },
  sidebar: {
    label: 'Sidebar (Lateral)',
    description: 'Coluna lateral (desktop)',
    layout: 'vertical',
    maxItems: 3,
    dimensions: '300×250 px',
    requiresImage: false,
    icon: Columns,
    color: 'text-teal-500',
  },
  native: {
    label: 'Card Nativo',
    description: 'Card nativo intercalado em listagens',
    layout: 'card',
    maxItems: 1,
    dimensions: '600×400 px',
    requiresImage: true,
    icon: ImageIcon,
    color: 'text-cyan-500',
  },
  footer: {
    label: 'Footer (Rodapé)',
    description: 'Acima do rodapé global',
    layout: 'banner',
    maxItems: 1,
    dimensions: '728×90 px',
    requiresImage: true,
    icon: Columns,
    color: 'text-gray-500',
  },
};

/** All valid position keys */
export const POSITION_KEYS = Object.keys(POSITION_CONFIG);

/** Helper: get config for a position, with safe fallback */
export function getPositionConfig(position: string): PositionEntry {
  return POSITION_CONFIG[position] ?? {
    label: position,
    description: '',
    layout: 'banner',
    maxItems: 3,
    dimensions: '',
    requiresImage: false,
    icon: Zap,
    color: 'text-muted-foreground',
  };
}
