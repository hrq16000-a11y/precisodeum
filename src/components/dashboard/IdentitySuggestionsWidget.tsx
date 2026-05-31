import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { UserCog, Check, X, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthIdentity } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface IdentitySuggestion {
  id: string;
  field: string;
  suggested_value: string;
  source: string | null;
  status: string;
  created_at: string;
}

const FIELD_LABEL: Record<string, string> = {
  full_name: 'Nome completo',
  display_name: 'Nome de exibição',
  tax_id: 'Documento (CPF/CNPJ)',
  document: 'Documento (CPF/CNPJ)',
  whatsapp: 'WhatsApp',
  phone: 'Telefone',
};

interface Props {
  className?: string;
  /** Limita itens (resumo no dashboard); a página completa exibe tudo. */
  limit?: number;
  /** Esconde o link "Ver todas" quando estamos justamente nessa página. */
  hideViewAllLink?: boolean;
}

const IdentitySuggestionsWidget = ({ className = '', limit, hideViewAllLink = false }: Props) => {
  const { user } = useAuthIdentity();
  const [items, setItems] = useState<IdentitySuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profile_change_suggestions' as any)
        .select('id, field, suggested_value, source, status, created_at')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (!error) setItems((data as unknown as IdentitySuggestion[]) || []);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAction = async (id: string, action: 'apply' | 'dismiss') => {
    setActingId(id);
    try {
      const { data, error } = await supabase.rpc('resolve_identity_suggestion' as any, {
        _suggestion_id: id,
        _action: action,
      });
      if (error) throw error;
      const status = (data as any)?.status;
      if (status === 'applied') toast.success('Sugestão aplicada ao seu perfil.');
      else if (status === 'dismissed') toast.info('Sugestão recusada.');
      else if (status === 'already_resolved') toast.info('Esta sugestão já foi tratada.');
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível processar a sugestão.');
    } finally {
      setActingId(null);
    }
  };

  if (loading || items.length === 0) return null;

  const visible = limit ? items.slice(0, limit) : items;
  const hasMore = limit ? items.length > limit : false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent p-4 ${className}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="rounded-xl bg-amber-500/15 p-1.5">
          <UserCog className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground">Sugestões de identidade</h3>
          <p className="text-[11px] text-muted-foreground">
            Detectamos divergências no seu perfil. Confirme ou recuse.
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {visible.map((s) => {
            const label = FIELD_LABEL[s.field?.toLowerCase()] || s.field;
            const busy = actingId === s.id;
            return (
              <motion.li
                key={s.id}
                layout
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
                className="rounded-xl border border-border bg-card p-3"
              >
                <p className="text-xs text-muted-foreground">
                  Vimos que você usa{' '}
                  <strong className="text-foreground">"{s.suggested_value}"</strong> em seus{' '}
                  {s.source || 'serviços'}. Atualizar seu {label.toLowerCase()}?
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => handleAction(s.id, 'apply')}
                    disabled={busy}
                  >
                    {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Confirmar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1"
                    onClick={() => handleAction(s.id, 'dismiss')}
                    disabled={busy}
                  >
                    <X className="h-3 w-3" />
                    Ignorar
                  </Button>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      {hasMore && !hideViewAllLink && (
        <Link
          to="/dashboard/sugestoes-identidade"
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:underline"
        >
          Ver todas as {items.length} sugestões <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </motion.div>
  );
};

export default IdentitySuggestionsWidget;
