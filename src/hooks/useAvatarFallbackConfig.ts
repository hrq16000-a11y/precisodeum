import { useMemo } from 'react';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import type { BoringVariant } from '@/lib/boringAvatarSvg';

export type AvatarFallbackMode = 'portfolio' | 'initials' | 'icon' | 'boring';

export interface AvatarFallbackConfig {
  enabled: boolean;
  mode: AvatarFallbackMode;
  useServiceImage: boolean;
  palette: Array<{ bg: string; fg: string }>;
  boringVariant: BoringVariant;
}

const DEFAULT_PALETTE: Array<{ bg: string; fg: string }> = [
  { bg: '#1e3a8a', fg: '#ffffff' },
  { bg: '#0f766e', fg: '#ffffff' },
  { bg: '#7c2d12', fg: '#ffffff' },
  { bg: '#4338ca', fg: '#ffffff' },
  { bg: '#166534', fg: '#ffffff' },
  { bg: '#9a3412', fg: '#ffffff' },
  { bg: '#334155', fg: '#ffffff' },
  { bg: '#155e75', fg: '#ffffff' },
  { bg: '#854d0e', fg: '#ffffff' },
  { bg: '#6b21a8', fg: '#ffffff' },
];

const BORING_VARIANTS: ReadonlyArray<BoringVariant> = [
  'marble', 'beam', 'pixel', 'sunset', 'ring', 'bauhaus',
];

function parsePalette(raw?: string): Array<{ bg: string; fg: string }> {
  if (!raw) return DEFAULT_PALETTE;
  const list = raw
    .split(/[,\s]+/)
    .map((c) => c.trim())
    .filter((c) => /^#?[0-9a-fA-F]{3,8}$/.test(c))
    .map((c) => (c.startsWith('#') ? c : `#${c}`));
  if (list.length === 0) return DEFAULT_PALETTE;
  return list.map((bg) => ({ bg, fg: '#ffffff' }));
}

export function useAvatarFallbackConfig(): AvatarFallbackConfig {
  const { data } = useSiteSettings();
  return useMemo<AvatarFallbackConfig>(() => {
    const flags = data?.flags || {};
    const values = data?.values || {};
    const modeRaw = (values['avatar_fallback_mode'] || 'portfolio').toLowerCase();
    const mode: AvatarFallbackMode =
      modeRaw === 'initials' || modeRaw === 'icon' || modeRaw === 'boring'
        ? (modeRaw as AvatarFallbackMode)
        : 'portfolio';
    const variantRaw = (values['avatar_fallback_boring_variant'] || 'marble').toLowerCase();
    const boringVariant: BoringVariant = (BORING_VARIANTS as readonly string[]).includes(variantRaw)
      ? (variantRaw as BoringVariant)
      : 'marble';
    return {
      enabled: flags['avatar_fallback_enabled'] !== false, // default ON if undefined
      mode,
      useServiceImage: flags['avatar_fallback_use_service_image'] !== false,
      palette: parsePalette(values['avatar_fallback_palette']),
      boringVariant,
    };
  }, [data]);
}
