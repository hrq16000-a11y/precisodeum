import { motion } from 'framer-motion';
import { Eye, MessageCircle, Phone, Users } from 'lucide-react';
import { useContactImpact } from '@/hooks/useContactImpact';
import AnimatedCounter from '@/components/ui/AnimatedCounter';

/**
 * "Impacto Real" — quantas pessoas viram/contactaram o profissional nas últimas 24h.
 * Lê de contact_clicks via RPC get_contact_impact_24h.
 */
const ContactImpactWidget = () => {
  const { data, isLoading } = useContactImpact();

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 animate-pulse h-[120px]" />
    );
  }

  const totalContacts = (data?.whatsapp_clicks ?? 0) + (data?.phone_clicks ?? 0);
  const visitors = data?.unique_visitors ?? 0;
  const hasActivity = visitors > 0 || totalContacts > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card p-4 sm:p-5 relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-10 bg-emerald-500" />

      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15">
          <Eye className="h-5 w-5 text-emerald-600" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foreground">Impacto Real (24h)</h3>
          <p className="text-[11px] text-muted-foreground">
            Atividade real no seu perfil hoje
          </p>
        </div>
      </div>

      {hasActivity ? (
        <div className="grid grid-cols-3 gap-2">
          <ImpactStat
            icon={<Users className="h-4 w-4 text-emerald-600" />}
            value={visitors}
            label="Pessoas viram seu contato"
          />
          <ImpactStat
            icon={<MessageCircle className="h-4 w-4 text-green-600" />}
            value={data?.whatsapp_clicks ?? 0}
            label="Cliques WhatsApp"
          />
          <ImpactStat
            icon={<Phone className="h-4 w-4 text-blue-600" />}
            value={data?.phone_clicks ?? 0}
            label="Cliques Telefone"
          />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Ainda sem visualizações nas últimas 24h. Compartilhe seu perfil para começar.
        </p>
      )}
    </motion.div>
  );
};

const ImpactStat = ({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) => (
  <div className="rounded-xl bg-muted/40 p-2.5 text-center">
    <div className="flex items-center justify-center mb-1">{icon}</div>
    <div className="text-xl font-black text-foreground">
      <AnimatedCounter value={value} />
    </div>
    <p className="text-[10px] leading-tight text-muted-foreground">{label}</p>
  </div>
);

export default ContactImpactWidget;
