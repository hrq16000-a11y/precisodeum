import { motion } from 'framer-motion';
import AnimatedCounter from '@/components/ui/AnimatedCounter';
import { LucideIcon } from 'lucide-react';

interface StatCard {
  icon: LucideIcon;
  value: number | string;
  label: string;
  sublabel?: string;
  gradient: string;
  iconColor: string;
}

interface StatCardGridProps {
  cards: StatCard[];
}

const StatCardGrid = ({ cards }: StatCardGridProps) => {
  return (
    <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.08 + i * 0.05 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className={`group relative rounded-2xl border border-border/60 bg-gradient-to-br ${stat.gradient} p-3.5 shadow-sm hover:shadow-md transition-shadow overflow-hidden cursor-default`}
          >
            {/* Hover shine */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/8 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            
            <div className="flex items-center justify-between">
              <div className={`flex h-8 w-8 items-center justify-center rounded-xl bg-background/60 backdrop-blur-sm ${stat.iconColor} transition-transform duration-300 group-hover:scale-110`}>
                <Icon className="h-4 w-4" />
              </div>
              {stat.sublabel && (
                <span className="text-[9px] font-medium text-muted-foreground/70 bg-background/40 rounded-md px-1.5 py-0.5">
                  {stat.sublabel}
                </span>
              )}
            </div>
            
            <div className="mt-2.5">
              <AnimatedCounter value={stat.value} className="font-display text-xl font-bold text-foreground leading-none" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">{stat.label}</p>
          </motion.div>
        );
      })}
    </div>
  );
};

export default StatCardGrid;
