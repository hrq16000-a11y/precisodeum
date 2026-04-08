import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';

interface ProfileCompletenessProps {
  provider: any;
  profile: any;
  servicesCount: number;
  portfolioCount?: number;
}

const ProfileCompleteness = ({ provider, profile, servicesCount, portfolioCount = 0 }: ProfileCompletenessProps) => {
  const checks = [
    { label: 'Nome completo', done: !!profile?.full_name && profile.full_name.trim().length > 2 },
    { label: 'Foto de perfil', done: !!profile?.avatar_url },
    { label: 'Descrição profissional', done: !!provider?.description && provider.description.length > 20 },
    { label: 'Cidade informada', done: !!provider?.city },
    { label: 'WhatsApp cadastrado', done: !!provider?.whatsapp },
    { label: 'Pelo menos 1 serviço', done: servicesCount > 0 },
    { label: 'Fotos no portfólio', done: portfolioCount > 0 },
    { label: 'Categoria definida', done: !!provider?.category_id },
  ];

  const doneCount = checks.filter(c => c.done).length;
  const percentage = Math.round((doneCount / checks.length) * 100);

  // Smart tip based on what's missing
  const firstMissing = checks.find(c => !c.done);
  const tip = firstMissing
    ? `Dica: Complete "${firstMissing.label}" para melhorar seu ranking.`
    : '🎉 Perfil 100% completo! Você está no topo dos resultados.';

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {checks.map((check, i) => (
          <motion.div
            key={check.label}
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
      {percentage < 100 && (
        <motion.p
          className="mt-3 rounded-lg bg-accent/5 px-3 py-2 text-[11px] text-accent font-medium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          💡 {tip}
        </motion.p>
      )}
    </div>
  );
};

export default ProfileCompleteness;
