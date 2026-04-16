import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Listens for realtime DB events and shows sonner toasts for admin.
 * Blue for info, green for approvals/success, amber for action-needed.
 */
const AdminRealtimeToasts = () => {
  useEffect(() => {
    const channel = supabase
      .channel('admin-realtime-toasts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'providers',
      }, (payload) => {
        const p = payload.new as any;
        if (p.status === 'pending') {
          toast.warning('Novo prestador pendente', {
            description: p.business_name || 'Aguardando aprovação',
            duration: 6000,
          });
        } else {
          toast.success('Novo prestador cadastrado', {
            description: p.business_name || '',
            duration: 5000,
          });
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'leads',
      }, (payload) => {
        const l = payload.new as any;
        toast.info('Novo lead recebido', {
          description: l.client_name || 'Lead registrado',
          duration: 5000,
        });
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'reviews',
      }, () => {
        toast.success('Nova avaliação recebida', {
          duration: 4000,
        });
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'profiles',
      }, (payload) => {
        const p = payload.new as any;
        toast.info('Novo usuário cadastrado', {
          description: p.full_name || p.email || '',
          duration: 4000,
        });
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'error_reports',
      }, (payload) => {
        const e = payload.new as any;
        toast.error('Erro reportado', {
          description: e.error_message?.slice(0, 80) || 'Verifique o painel',
          duration: 8000,
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return null;
};

export default AdminRealtimeToasts;
