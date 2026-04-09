import { motion } from 'framer-motion';
import { TrendingUp, MousePointerClick, Eye, MessageSquare, Percent } from 'lucide-react';
import AnimatedCounter from '@/components/ui/AnimatedCounter';

interface ConversionInsightsProps {
  views: number;
  leads: number;
  services: number;
}

const ConversionInsights = ({ views, leads, services }: ConversionInsightsProps) => {
  const conversionRate = views > 0 ? ((leads / views) * 100) : 0;
  const leadsPerService = services > 0 ? (leads / services) : 0;

  const metrics = [
    {
      icon: Eye,
      label: 'Visualizações',
      value: views,
      format: 'number' as const,
      color: 'text-sky-500',
      bg: 'bg-sky-500/10',
    },
    {
      icon: MousePointerClick,
      label: 'Leads gerados',
      value: leads,
      format: 'number' as const,
      color: 'text-violet-500',
      bg: 'bg-violet-500/10',
    },
    {
      icon: Percent,
      label: 'Taxa conversão',
      value: conversionRate,
      format: 'percent' as const,
      color: conversionRate >= 5 ? 'text-emerald-500' : conversionRate >= 2 ? 'text-amber-500' : 'text-red-400',
      bg: conversionRate >= 5 ? 'bg-emerald-500/10' : conversionRate >= 2 ? 'bg-amber-500/10' : 'bg-red-400/10',
    },
    {
      icon: TrendingUp,
      label: 'Leads/serviço',
      value: leadsPerService,
      format: 'decimal' as const,
      color: 'text-accent',
      bg: 'bg-accent/10',
    },
  ];

  return (
    <div>
      <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-accent" />
        Insights de Conversão
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((m, i) => {
          const Icon = m.icon;
          return (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="rounded-xl border border-border p-3 bg-card/50 hover:bg-card transition-colors"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`flex h-6 w-6 items-center justify-center rounded-md ${m.bg}`}>
                  <Icon className={`h-3 w-3 ${m.color}`} />
                </div>
                <span className="text-[10px] text-muted-foreground font-medium">{m.label}</span>
              </div>
              <p className="font-display text-lg font-bold text-foreground">
                {m.format === 'percent'
                  ? `${m.value.toFixed(1)}%`
                  : m.format === 'decimal'
                    ? m.value.toFixed(1)
                    : <AnimatedCounter value={m.value} />}
              </p>
            </motion.div>
          );
        })}
      </div>
      {conversionRate > 0 && conversionRate < 2 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-3 rounded-lg bg-amber-500/5 border border-amber-500/10 px-3 py-2 text-[11px] text-amber-600 dark:text-amber-400"
        >
          💡 Dica: Adicione mais fotos ao portfólio e complete a descrição para aumentar conversões.
        </motion.p>
      )}
      {conversionRate >= 5 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10 px-3 py-2 text-[11px] text-emerald-600 dark:text-emerald-400"
        >
          🚀 Excelente! Sua taxa de conversão está acima da média da plataforma.
        </motion.p>
      )}
    </div>
  );
};

export default ConversionInsights;
