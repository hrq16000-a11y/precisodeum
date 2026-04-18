import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface SmartAvatarProps {
  src?: string | null;
  name?: string | null;
  className?: string;
  fallbackClassName?: string;
  alt?: string;
}

/**
 * Resolve a URL de imagem com segurança:
 * - URLs externas instáveis (ui-avatars.com) → ignoradas (vira fallback de iniciais)
 * - Caminhos relativos (sem http) → concatenados ao bucket público correto
 * - URLs absolutas válidas → mantidas
 */
export function resolveImageSrc(src?: string | null, defaultBucket = 'avatars'): string | undefined {
  if (!src) return undefined;
  const trimmed = src.trim();
  if (!trimmed) return undefined;

  // Bloquear placeholder externo instável
  if (trimmed.includes('ui-avatars.com')) return undefined;

  // URL absoluta — usar como está
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;

  // Caminho relativo no storage → reconstruir URL pública
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  if (!projectId) return undefined;

  // Detectar bucket no início do caminho
  const knownBuckets = ['avatars', 'portfolio', 'service-images', 'sponsors'];
  const firstSegment = trimmed.split('/')[0];
  const bucket = knownBuckets.includes(firstSegment) ? firstSegment : defaultBucket;
  const path = knownBuckets.includes(firstSegment)
    ? trimmed.slice(firstSegment.length + 1)
    : trimmed;

  return `https://${projectId}.supabase.co/storage/v1/object/public/${bucket}/${path}`;
}

/** Gera iniciais limpas a partir do nome completo (até 2 letras). */
export function getInitials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * SmartAvatar — substitui qualquer dependência de ui-avatars.com.
 * Renderiza iniciais via CSS quando a imagem está vazia, quebrada ou inválida.
 */
const SmartAvatar = ({ src, name, className, fallbackClassName, alt }: SmartAvatarProps) => {
  const resolved = resolveImageSrc(src);
  const initials = getInitials(name);

  return (
    <Avatar className={cn('bg-muted', className)}>
      {resolved && <AvatarImage src={resolved} alt={alt || name || 'Avatar'} />}
      <AvatarFallback
        className={cn('bg-primary text-primary-foreground font-bold', fallbackClassName)}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
};

export default SmartAvatar;
