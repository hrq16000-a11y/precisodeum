import { useUpsellTrigger } from '@/hooks/useUpsellTrigger';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, ArrowRight, TrendingUp, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const UpsellBanner = () => {
  const { level, message, trigger, servicesPct, leadsPct, isPremium, loading } = useUpsellTrigger();
  const navigate = useNavigate();

  if (loading || level === 'none' || isPremium) return null;

  const isCritical = level === 'critical';
  const pct = trigger === 'services' ? servicesPct : leadsPct;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        className={`
          relative overflow-hidden rounded-xl border p-4 md:p-5
          ${isCritical
            ? 'bg-gradient-to-r from-destructive/5 via-destructive/10 to-warning/5 border-destructive/20'
            : 'bg-gradient-to-r from-warning/5 via-warning/10 to-accent/5 border-warning/20'
          }
        `}
      >
        {/* Background glow */}
        <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl pointer-events-none ${
          isCritical ? 'bg-destructive/10' : 'bg-warning/10'
        }`} />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Icon */}
          <div className={`
            flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center
            ${isCritical
              ? 'bg-destructive/15 text-destructive'
              : 'bg-warning/15 text-warning'
            }
          `}>
            {isCritical ? <AlertTriangle className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${isCritical ? 'text-destructive' : 'text-warning'}`}>
              {isCritical ? 'Limite atingido!' : 'Quase no limite'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {message}
            </p>

            {/* Progress bar */}
            {pct !== null && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(pct, 100)}%` }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                    className={`h-full rounded-full ${
                      isCritical ? 'bg-destructive' : 'bg-warning'
                    }`}
                  />
                </div>
                <span className={`text-[10px] font-bold ${isCritical ? 'text-destructive' : 'text-warning'}`}>
                  {pct}%
                </span>
              </div>
            )}
          </div>

          {/* CTA */}
          <Button
            size="sm"
            onClick={() => navigate('/dashboard/plano')}
            className={`
              flex-shrink-0 gap-1.5 group shadow-sm
              ${isCritical
                ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
                : 'bg-warning hover:bg-warning/90 text-warning-foreground'
              }
            `}
          >
            <Zap className="h-3.5 w-3.5" />
            Fazer upgrade
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default UpsellBanner;
