/**
 * LockedSlotCard — Visual cadeado que substitui um slot bloqueado.
 *
 * Faz parte do "desbloqueio progressivo": o usuário começa com 1 slot
 * liberado e ganha mais a cada item cadastrado, até o limite máximo.
 * Mensagem motivadora reforça a recompensa: mais destaque no Google.
 */
import { Lock } from 'lucide-react';
import { motion } from 'framer-motion';

interface LockedSlotCardProps {
  /** Texto curto explicando o que será desbloqueado (ex: "2º serviço"). */
  label: string;
  /** Variante visual: card grande (services) ou compacto (portfolio). */
  variant?: 'default' | 'compact';
}

const LockedSlotCard = ({ label, variant = 'default' }: LockedSlotCardProps) => {
  const isCompact = variant === 'compact';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className={`relative overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/30 ${
        isCompact ? 'p-4' : 'p-5'
      } flex flex-col items-center justify-center text-center gap-2`}
      role="group"
      aria-label={`Slot bloqueado — ${label}`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background border border-border shadow-sm">
        <Lock className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-[11px] text-muted-foreground leading-snug max-w-[200px]">
        Cadastre o item anterior para liberar este poder e ganhar mais destaque no Google.
      </p>
    </motion.div>
  );
};

export default LockedSlotCard;
