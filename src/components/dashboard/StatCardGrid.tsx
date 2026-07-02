import { motion } from 'framer-motion';
import AnimatedCounter from '@/components/ui/AnimatedCounter';
import { LucideIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface StatCard {
  icon: LucideIcon;
  value: number | string;
  label: string;
  sublabel?: string;
  tooltip?: string;
  gradient: string;
  iconColor: string;
}

interface StatCardGridProps {
  cards: StatCard[];
}

const StatCardGrid = ({ cards }: StatCardGridProps) => {
  // Find max numeric value for pulse effect
  const maxVal = Math.max(...cards.map(c => typeof c.value === 'number' ? c.value : 0), 0);

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
      <TooltipProvider delayDuration={300}>
        {cards.map((stat, i) => {
          const Icon = stat.icon;
          const isMax = typeof stat.value === 'number' && stat.value === maxVal && maxVal > 0;

          const card = (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.08 + i * 0.05 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className={`group relative rounded-2xl border border-border/60 bg-gradient-to-br ${stat.gradient} p-4 shadow-sm hover:shadow-md transition-shadow overflow-hidden cursor-default`}
            >
              {/* Hover shine */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/8 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />

              {/* Pulse ring on max value card */}
              {isMax && (
                <div className="absolute top-3 right-3">
                  <span className="flex h-2 w-2">
                    <span className="animate-ping absolute h-2 w-2 rounded-full bg-accent/60" />
                    <span className="relative h-2 w-2 rounded-full bg-accent" />
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-background/60 backdrop-blur-sm ${stat.iconColor} transition-transform duration-300 group-hover:scale-110`}>
                  <Icon className="h-5 w-5" />
                </div>
                {stat.sublabel && (
                  <span className="text-[9px] font-medium text-muted-foreground/70 bg-background/40 rounded-md px-1.5 py-0.5">
                    {stat.sublabel}
                  </span>
                )}
              </div>

              <div className="mt-3">
                <AnimatedCounter value={stat.value} className="font-display text-2xl font-bold text-foreground leading-none" />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5 font-medium">{stat.label}</p>
            </motion.div>
          );

          if (stat.tooltip) {
            return (
              <Tooltip key={i}>
                <TooltipTrigger asChild>{card}</TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                  {stat.tooltip}
                </TooltipContent>
              </Tooltip>
            );
          }

          return card;
        })}
      </TooltipProvider>
    </div>
  );
};

export default StatCardGrid;
