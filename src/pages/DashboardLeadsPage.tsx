import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Phone, MessageCircle, AlertTriangle, Inbox, Trash2, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { whatsappLink } from '@/lib/whatsapp';
import { useAuth } from '@/hooks/useAuth';
import { useAccountLimits } from '@/hooks/useAccountLimits';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

const DashboardLeadsPage = () => {
  const { user, provider, loading } = useAuth();
  const { limits, canReceiveMoreLeads, remainingLeads, loading: limitsLoading } = useAccountLimits();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<any[]>([]);

  const handleDelete = async (leadId: string) => {
    const { error } = await supabase.from('leads').delete().eq('id', leadId);
    if (error) {
      toast.error('Erro ao excluir lead');
      return;
    }
    setLeads(prev => prev.filter(l => l.id !== leadId));
    toast.success('Lead excluído');
  };

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!provider) return;
    supabase.from('leads')
      .select('*')
      .eq('provider_id', provider.id)
      .order('lead_score', { ascending: false })
      .then(({ data }) => { if (data) setLeads(data); });
  }, [provider]);

  if (loading) return <DashboardLayout><p className="text-muted-foreground">Carregando...</p></DashboardLayout>;

  if (!limitsLoading && limits?.can_receive_leads === false) {
    return (
      <DashboardLayout>
        <motion.div
          className="flex flex-col items-center justify-center py-20 text-center"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <AlertTriangle className="h-12 w-12 text-destructive/60 mb-4" />
          <h1 className="font-display text-xl font-bold text-foreground">Leads indisponível</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-md">
            Sua categoria de conta atual não permite receber leads. Aumente seu engajamento para desbloquear este recurso.
          </p>
        </motion.div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="font-display text-2xl font-bold text-foreground">Leads Recebidos</h1>
        <p className="mt-1 text-sm text-muted-foreground">{leads.length} lead(s) recebido(s)</p>
      </motion.div>

      {/* Limits banner */}
      {!limitsLoading && limits && remainingLeads !== null && (
        <motion.div
          className={`mt-3 rounded-lg border p-3 text-sm ${!canReceiveMoreLeads ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'border-accent/20 bg-accent/5 text-foreground'}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <div className="flex items-center gap-2">
            {!canReceiveMoreLeads && <AlertTriangle className="h-4 w-4 shrink-0" />}
            <span>
              {!canReceiveMoreLeads
                ? `Limite de ${limits.max_leads} lead(s) atingido para sua categoria. Engaje-se mais para desbloquear capacidade adicional.`
                : `${remainingLeads} de ${limits.max_leads} lead(s) restante(s) na sua categoria.`}
            </span>
          </div>
        </motion.div>
      )}

      <motion.div
        className="mt-6 space-y-3"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <AnimatePresence mode="popLayout">
        {leads.length === 0 && (
          <motion.div
            key="empty"
            variants={itemVariants}
            exit={{ opacity: 0, scale: 0.95 }}
            className="rounded-xl border border-border bg-card p-12 text-center shadow-card"
          >
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Inbox className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            </motion.div>
            <p className="text-foreground font-semibold">Nenhum lead recebido</p>
            <p className="mt-1 text-sm text-muted-foreground">Quando clientes solicitarem orçamento, os leads aparecerão aqui.</p>
          </motion.div>
        )}
        {leads.map((lead) => (
          <motion.div
            key={lead.id}
            layout
            variants={itemVariants}
            exit={{ opacity: 0, x: -80, transition: { duration: 0.3 } }}
            whileHover={{ y: -2, scale: 1.005 }}
            className="rounded-xl border border-border bg-card p-4 shadow-card transition-shadow hover:shadow-card-hover"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{lead.client_name}</p>
                  {lead.lead_score != null && (
                    <span className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0 text-[10px] font-bold ${
                      lead.lead_score >= 80 ? 'text-green-600 bg-green-50 border-green-200' :
                      lead.lead_score >= 60 ? 'text-amber-600 bg-amber-50 border-amber-200' :
                      lead.lead_score >= 40 ? 'text-orange-600 bg-orange-50 border-orange-200' :
                      'text-red-500 bg-red-50 border-red-200'
                    }`}>
                      <TrendingUp className="h-2.5 w-2.5" />{lead.lead_score}
                    </span>
                  )}
                </div>
                {lead.service_needed && <p className="text-xs text-accent font-medium">{lead.service_needed}</p>}
                {lead.message && <p className="mt-1 text-xs text-muted-foreground">{lead.message}</p>}
              </div>
              <div className="text-right shrink-0 flex flex-col items-end gap-1">
                <p className="text-xs text-muted-foreground">{new Date(lead.created_at).toLocaleDateString('pt-BR')}</p>
                <div className="flex items-center gap-2">
                  <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                    <Phone className="h-3 w-3" /> {lead.phone}
                  </a>
                  <motion.a
                    href={whatsappLink(lead.phone, `Olá ${lead.client_name}, recebi sua solicitação${lead.service_needed ? ` sobre "${lead.service_needed}"` : ''}. Como posso ajudar?`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-full bg-[#25D366] p-1.5 text-white hover:bg-[#1da851] transition-colors"
                    title="Responder pelo WhatsApp"
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </motion.a>
                  <motion.button
                    onClick={() => handleDelete(lead.id)}
                    className="inline-flex items-center justify-center rounded-full bg-destructive/10 p-1.5 text-destructive hover:bg-destructive/20 transition-colors"
                    title="Excluir lead"
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </motion.button>
                </div>
              </div>
            </div>
            <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${lead.status === 'new' ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'}`}>
              {lead.status === 'new' ? '🔴 Novo' : lead.status}
            </span>
          </motion.div>
        ))}
        </AnimatePresence>
      </motion.div>
    </DashboardLayout>
  );
};

export default DashboardLeadsPage;
