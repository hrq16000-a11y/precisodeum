import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

interface ProgressRingProps {
  value: number; // 0–100
  size?: number;
  strokeWidth?: number;
  className?: string;
  color?: string;
  label?: string;
}

const ProgressRing = ({ value, size = 80, strokeWidth = 6, className = '', color, label }: ProgressRingProps) => {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: '-30px' });
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(value, 100) / 100) * circumference;

  return (
    <div className={`relative inline-flex flex-col items-center ${className}`}>
      <svg ref={ref} width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color || 'hsl(var(--accent))'}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={inView ? { strokeDashoffset: offset } : {}}
          transition={{ duration: 1.2, ease: 'easeOut' as const, delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-foreground">{Math.round(value)}%</span>
      </div>
      {label && <span className="mt-1.5 text-[10px] text-muted-foreground">{label}</span>}
    </div>
  );
};

export default ProgressRing;
