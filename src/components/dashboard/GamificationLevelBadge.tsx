import { motion } from 'framer-motion';

interface GamificationLevelBadgeProps {
  levelName: string;
  levelColor: string;
  levelIcon: string;
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

const sizeClasses = {
  sm: 'h-6 px-2 text-[10px] gap-1',
  md: 'h-8 px-3 text-xs gap-1.5',
  lg: 'h-10 px-4 text-sm gap-2',
};

const GamificationLevelBadge = ({ levelName, levelColor, levelIcon, size = 'md', showShine = true }: GamificationLevelBadgeProps) => {
  const gradient = getMetallicGradient(levelName);
  const isMestre = levelName.toLowerCase().includes('mestre') || levelName.toLowerCase().includes('master');

  return (
    <motion.span
      className={`inline-flex items-center font-bold rounded-full relative overflow-hidden shadow-lg ${sizeClasses[size]}`}
      style={{
        background: gradient,
        color: isMestre ? '#fff' : '#1a1a1a',
        boxShadow: `0 2px 12px ${levelColor}40, inset 0 1px 2px rgba(255,255,255,0.3)`,
      }}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      whileHover={{ scale: 1.05, boxShadow: `0 4px 20px ${levelColor}60` }}
    >
      {/* Shine animation */}
      {showShine && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.4) 50%, transparent 60%)',
          }}
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 3, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }}
        />
      )}
      <span className="relative z-10">{levelIcon}</span>
      <span className="relative z-10 tracking-wide">{levelName}</span>
    </motion.span>
  );
};

export default GamificationLevelBadge;
