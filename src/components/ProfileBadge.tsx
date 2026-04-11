import { BadgeCheck, UserCheck } from 'lucide-react';
import { motion } from 'framer-motion';

interface ProfileBadgeProps {
  hasPhoto: boolean;
  hasServices: boolean;
  size?: 'sm' | 'md';
  delay?: number;
}

const ProfileBadge = ({ hasPhoto, hasServices, size = 'md', delay = 0.5 }: ProfileBadgeProps) => {
  const isComplete = hasPhoto && hasServices;

  if (!isComplete) return null;

  const label = 'Perfil Completo';
  const Icon = BadgeCheck;

  if (size === 'sm') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent border border-accent/20">
        <Icon className="h-3 w-3" /> {label}
      </span>
    );
  }

  return (
    <motion.span
      className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent border border-accent/20"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 20 }}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </motion.span>
  );
};

export default ProfileBadge;
