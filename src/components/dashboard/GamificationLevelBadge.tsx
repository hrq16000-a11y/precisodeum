import { motion } from 'framer-motion';
import { Trophy, Award, Gem, Crown, Star } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface GamificationLevelBadgeProps {
  levelName: string;
  levelColor: string;
  /** @deprecated Use Lucide icon names only. Emoji strings are ignored. */
  levelIcon?: string;
  size?: 'sm' | 'md' | 'lg';
  showShine?: boolean;
}

const METALLIC_GRADIENTS: Record<string, string> = {
  bronze: 'linear-gradient(135deg, #CD7F32, #E8A954, #CD7F32, #A0522D)',
  prata: 'linear-gradient(135deg, #C0C0C0, #E8E8E8, #C0C0C0, #A8A8A8)',
  ouro: 'linear-gradient(135deg, #FFD700, #FFF4A3, #FFD700, #DAA520)',
  diamante: 'linear-gradient(135deg, #B9F2FF, #E0F7FA, #4DD0E1, #00ACC1)',
  mestre: 'linear-gradient(135deg, #7C3AED, #A855F7, #C084FC, #7C3AED)',
};

function getMetallicGradient(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('bronze')) return METALLIC_GRADIENTS.bronze;
  if (lower.includes('prata') || lower.includes('silver')) return METALLIC_GRADIENTS.prata;
  if (lower.includes('ouro') || lower.includes('gold')) return METALLIC_GRADIENTS.ouro;
  if (lower.includes('diamante') || lower.includes('diamond')) return METALLIC_GRADIENTS.diamante;
  if (lower.includes('mestre') || lower.includes('master')) return METALLIC_GRADIENTS.mestre;
  return `linear-gradient(135deg, ${name}, ${name}88)`;
}

function getLevelIcon(name: string): LucideIcon {
  const lower = name.toLowerCase();
  if (lower.includes('bronze')) return Award;
  if (lower.includes('prata') || lower.includes('silver')) return Star;
  if (lower.includes('ouro') || lower.includes('gold')) return Trophy;
  if (lower.includes('diamante') || lower.includes('diamond')) return Gem;
  if (lower.includes('mestre') || lower.includes('master')) return Crown;
  return Trophy;
}

const sizeClasses = {
  sm: 'h-6 px-2 text-[10px] gap-1',
  md: 'h-8 px-3 text-xs gap-1.5',
  lg: 'h-10 px-4 text-sm gap-2',
};

const iconSizes = { sm: 12, md: 14, lg: 16 };

const GamificationLevelBadge = ({ levelName, levelColor, size = 'md', showShine = true }: GamificationLevelBadgeProps) => {
  const gradient = getMetallicGradient(levelName);
  const lower = levelName.toLowerCase();
  const isMestre = lower.includes('mestre') || lower.includes('master');
  const isDiamante = lower.includes('diamante') || lower.includes('diamond');
  const IconComp = getLevelIcon(levelName);

  // Diamante = "máximo prestígio": glow pulsante cyan + shine acelerado.
  const diamanteGlow = isDiamante
    ? '0 0 0 2px rgba(185,242,255,0.6), 0 0 18px 4px rgba(77,208,225,0.55), 0 0 32px 8px rgba(0,172,193,0.35), inset 0 1px 2px rgba(255,255,255,0.5)'
    : `0 2px 12px ${levelColor}40, inset 0 1px 2px rgba(255,255,255,0.3)`;

  return (
    <motion.span
      className={`inline-flex items-center font-bold rounded-full relative overflow-hidden shadow-lg ${sizeClasses[size]}`}
      style={{
        background: gradient,
        color: isMestre ? '#fff' : '#1a1a1a',
        boxShadow: diamanteGlow,
        // GPU-accelerate the diamante glow loop so it stays buttery on older Android devices.
        willChange: isDiamante ? 'transform, box-shadow, opacity' : undefined,
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden' as const,
      }}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={
        isDiamante
          ? {
              scale: [1, 1.04, 1],
              boxShadow: [
                '0 0 0 2px rgba(185,242,255,0.45), 0 0 14px 3px rgba(77,208,225,0.4), 0 0 26px 6px rgba(0,172,193,0.25), inset 0 1px 2px rgba(255,255,255,0.5)',
                '0 0 0 3px rgba(185,242,255,0.75), 0 0 22px 6px rgba(77,208,225,0.7), 0 0 38px 10px rgba(0,172,193,0.45), inset 0 1px 2px rgba(255,255,255,0.6)',
                '0 0 0 2px rgba(185,242,255,0.45), 0 0 14px 3px rgba(77,208,225,0.4), 0 0 26px 6px rgba(0,172,193,0.25), inset 0 1px 2px rgba(255,255,255,0.5)',
              ],
            }
          : { scale: 1, opacity: 1 }
      }
      transition={
        isDiamante
          ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
          : { type: 'spring', stiffness: 300, damping: 20 }
      }
      whileHover={{ scale: 1.06 }}
    >
      {showShine && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: isDiamante
              ? 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.7) 50%, transparent 65%)'
              : 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.4) 50%, transparent 60%)',
            willChange: 'transform',
            transform: 'translateZ(0)',
          }}
          animate={{ x: ['-100%', '200%'] }}
          transition={{
            duration: isDiamante ? 1.8 : 3,
            repeat: Infinity,
            repeatDelay: isDiamante ? 1.2 : 4,
            ease: 'easeInOut',
          }}
        />
      )}
      <IconComp
        className="relative z-10 shrink-0"
        size={iconSizes[size]}
        strokeWidth={1.75}
        style={isDiamante ? { filter: 'drop-shadow(0 0 4px rgba(185,242,255,0.9))' } : undefined}
      />
      <span className="relative z-10 tracking-wide">{levelName}</span>
    </motion.span>
  );
};

export default GamificationLevelBadge;
