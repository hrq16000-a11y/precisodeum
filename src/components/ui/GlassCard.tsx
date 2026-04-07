import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlassCardProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'gradient' | 'glow' | 'bordered';
  hoverEffect?: boolean;
  delay?: number;
}

const variantClasses: Record<string, string> = {
  default: 'glass border border-border shadow-card',
  gradient: 'glass border border-primary/10 shadow-card bg-gradient-to-br from-card via-card to-primary/5',
  glow: 'glass border border-accent/20 shadow-card hover:glow-accent',
  bordered: 'glass border-2 border-primary/15 shadow-card',
};

const GlassCard = ({ children, className, variant = 'default', hoverEffect = true, delay = 0, ...props }: GlassCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' as const }}
      whileHover={hoverEffect ? { y: -4, scale: 1.02, transition: { duration: 0.2 } } : undefined}
      className={cn('rounded-2xl p-5 relative overflow-hidden', variantClasses[variant], className)}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default GlassCard;
