import { CheckCircle2, Circle } from 'lucide-react';
import { motion } from 'framer-motion';
import { buildOnboardingChecklist, checklistStats } from '@/lib/onboardingChecklist';

interface ProfileCompletenessProps {
  provider: any;
  profile: any;
  servicesCount: number;
  portfolioCount?: number;
}

/**
 * Resumo visual da completude do perfil. Usa a MESMA fonte da verdade
 * (`onboardingChecklist`) que o FirstLeadChecklist e o Wizard, garantindo
 * que as porcentagens nunca divirjam entre componentes.
 */
const ProfileCompleteness = ({ provider, profile, servicesCount, portfolioCount = 0 }: ProfileCompletenessProps) => {
  const items = buildOnboardingChecklist({
    profile,
    provider,
    servicesCount,
    portfolioAlbumsCount: portfolioCount,
  });
  const { pct, firstMissing } = checklistStats(items);

  const tip = firstMissing
    ? `Dica: Complete "${firstMissing.label}" para melhorar seu ranking.`
    : 'Perfil 100% completo! Você está no topo dos resultados.';

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {items.map((check, i) => (
          <motion.div
            key={check.key}
            className="flex items-center gap-2 text-xs"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            {check.done ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
            ) : (
              <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
            )}
            <span className={check.done ? 'text-muted-foreground line-through decoration-muted-foreground/30' : 'text-foreground font-medium'}>
              {check.label}
            </span>
          </motion.div>
        ))}
      </div>
      {pct < 100 && (
        <motion.p
          className="mt-3 rounded-lg bg-accent/5 px-3 py-2 text-[11px] text-accent font-medium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {tip}
        </motion.p>
      )}
    </div>
  );
};

export default ProfileCompleteness;
