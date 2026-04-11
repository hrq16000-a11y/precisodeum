import { Briefcase, Clock, CheckCircle2, XCircle, Shield } from 'lucide-react';
import { motion } from 'framer-motion';

interface ProviderStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  verified: number;
}

const ProviderStatsCards = ({ stats }: { stats: ProviderStats }) => {
  const cards = [
    { label: 'Total', value: stats.total, icon: Briefcase, color: 'border-l-primary text-primary' },
    { label: 'Pendentes', value: stats.pending, icon: Clock, color: 'border-l-amber-500 text-amber-600' },
    { label: 'Aprovados', value: stats.approved, icon: CheckCircle2, color: 'border-l-emerald-500 text-emerald-600' },
    { label: 'Rejeitados', value: stats.rejected, icon: XCircle, color: 'border-l-destructive text-destructive' },
    { label: 'Verificados', value: stats.verified, icon: Shield, color: 'border-l-blue-500 text-blue-600' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.06 }}
            className={`rounded-xl border border-border border-l-4 ${c.color.split(' ')[0]} bg-card p-3.5 shadow-card`}
          >
            <div className="flex items-center justify-between">
              <div className="rounded-lg bg-muted p-1.5">
                <Icon className={`h-4 w-4 ${c.color.split(' ')[1]}`} />
              </div>
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-foreground">{c.value}</p>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </motion.div>
        );
      })}
    </div>
  );
};

export default ProviderStatsCards;
