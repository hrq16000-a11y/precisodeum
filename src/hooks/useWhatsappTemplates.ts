/**
 * useWhatsappTemplates — CRUD de modelos de mensagem do WhatsApp.
 *
 * Variáveis suportadas no `content`:
 *   {{cliente}}   → nome do lead (lead.client_name)
 *   {{servico}}   → serviço solicitado (lead.service_needed)
 *   {{meu_nome}}  → primeiro nome do profissional logado
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface WhatsappTemplate {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export const TEMPLATE_VARIABLES = [
  { key: '{{cliente}}', label: 'Nome do cliente' },
  { key: '{{servico}}', label: 'Serviço solicitado' },
  { key: '{{meu_nome}}', label: 'Seu primeiro nome' },
] as const;

export function renderTemplate(
  content: string,
  vars: { cliente?: string | null; servico?: string | null; meu_nome?: string | null },
): string {
  return content
    .replace(/\{\{\s*cliente\s*\}\}/gi, vars.cliente?.trim() || 'cliente')
    .replace(/\{\{\s*servico\s*\}\}/gi, vars.servico?.trim() || 'serviço')
    .replace(/\{\{\s*meu_nome\s*\}\}/gi, vars.meu_nome?.trim() || '');
}

export function useWhatsappTemplates() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['whatsapp-templates', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('whatsapp_templates')
        .select('id, user_id, title, content, created_at, updated_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as WhatsappTemplate[];
    },
    staleTime: 60_000,
  });
}

export function useSaveWhatsappTemplate() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; title: string; content: string }) => {
      if (!user?.id) throw new Error('Sem usuário');
      const payload = { user_id: user.id, title: input.title.trim(), content: input.content.trim() };
      if (!payload.title) throw new Error('Dê um título ao modelo');
      if (!payload.content) throw new Error('Escreva o conteúdo do modelo');
      if (input.id) {
        const { error } = await (supabase as any)
          .from('whatsapp_templates')
          .update({ title: payload.title, content: payload.content })
          .eq('id', input.id)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('whatsapp_templates').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Modelo salvo');
      qc.invalidateQueries({ queryKey: ['whatsapp-templates', user?.id] });
    },
    onError: (e) => toast.error('Não foi possível salvar', { description: (e as Error).message }),
  });
}

export function useDeleteWhatsappTemplate() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error('Sem usuário');
      const { error } = await (supabase as any)
        .from('whatsapp_templates')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Modelo removido');
      qc.invalidateQueries({ queryKey: ['whatsapp-templates', user?.id] });
    },
    onError: (e) => toast.error('Não foi possível remover', { description: (e as Error).message }),
  });
}
