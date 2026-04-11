import { Flame, Zap, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface ConversionTagsProps {
  reviewCount: number;
  responseTime?: string | null;
  showMicrocopy?: boolean;
  compact?: boolean;
}

const ConversionTags = ({ reviewCount, responseTime, showMicrocopy = true, compact = false }: ConversionTagsProps) => {
  const tags: { icon: React.ReactNode; text: string; className: string }[] = [];

  if (reviewCount >= 5) {
    tags.push({
      icon: <Flame className="h-3 w-3" />,
      text: 'Muito requisitado',
      className: 'bg-orange-500/10 text-orange-600 border-orange-200',
    });
  }

  if (responseTime) {
    tags.push({
      icon: <Zap className="h-3 w-3" />,
      text: 'Responde rápido',
      className: 'bg-blue-500/10 text-blue-600 border-blue-200',
    });
  }

  tags.push({
    icon: <CheckCircle2 className="h-3 w-3" />,
    text: 'Orçamento sem compromisso',
    className: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  });

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1">
        {tags.slice(0, 2).map((t, i) => (
          <span key={i} className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${t.className}`}>
            {t.icon} {t.text}
          </span>
        ))}
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-2"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.4 }}
    >
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t, i) => (
          <motion.span
            key={i}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${t.className}`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 + i * 0.1, type: 'spring', stiffness: 300, damping: 20 }}
          >
            {t.icon} {t.text}
          </motion.span>
        ))}
      </div>
      {showMicrocopy && (
        <p className="text-[11px] text-muted-foreground">
          Orçamento sem compromisso. Fale direto com o profissional.
        </p>
      )}
    </motion.div>
  );
};

export default ConversionTags;
