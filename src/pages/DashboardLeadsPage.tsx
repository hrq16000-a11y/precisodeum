import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Phone, MessageCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const DashboardLeadsPage = () => {
  const { user, provider, loading } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!provider) return;
    supabase.from('leads')
      .select('*')
      .eq('provider_id', provider.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setLeads(data); });
  }, [provider]);

  if (loading) return <DashboardLayout><p className="text-muted-foreground">Carregando...</p></DashboardLayout>;

  return (
    <DashboardLayout>
      <h1 className="font-display text-2xl font-bold text-foreground">Leads Recebidos</h1>
      <p className="mt-1 text-sm text-muted-foreground">{leads.length} lead(s) recebido(s)</p>

      <div className="mt-6 space-y-3">
        {leads.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-12 text-center shadow-card">
            <p className="text-foreground font-semibold">Nenhum lead recebido</p>
            <p className="mt-1 text-sm text-muted-foreground">Quando clientes solicitarem orçamento, os leads aparecerão aqui.</p>
          </div>
        )}
        {leads.map(lead => (
          <div key={lead.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{lead.client_name}</p>
                {lead.service_needed && <p className="text-xs text-accent font-medium">{lead.service_needed}</p>}
                {lead.message && <p className="mt-1 text-xs text-muted-foreground">{lead.message}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">{new Date(lead.created_at).toLocaleDateString('pt-BR')}</p>
                <a href={`tel:${lead.phone}`} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                  <Phone className="h-3 w-3" /> {lead.phone}
                </a>
              </div>
            </div>
            <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${lead.status === 'new' ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'}`}>
              {lead.status === 'new' ? 'Novo' : lead.status}
            </span>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default DashboardLeadsPage;
