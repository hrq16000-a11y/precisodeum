import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, CheckCircle2, Eye, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface ErrorReport {
  id: string;
  page_path: string;
  action_context: string;
  error_message: string;
  severity: string;
  created_at: string;
  user_id: string;
  component_name: string | null;
  viewport: string | null;
  user_agent: string | null;
}

const AdminErrorAlerts = () => {
  const [errors, setErrors] = useState<ErrorReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchErrors = async () => {
    const { data } = await supabase
      .from('error_reports' as any)
      .select('*')
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(20);
    setErrors((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchErrors(); }, []);

  const markResolved = async (id: string) => {
    await (supabase.from('error_reports' as any) as any)
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', id);
    setErrors(prev => prev.filter(e => e.id !== id));
    toast.success('Erro marcado como resolvido');
  };

  if (loading) return null;
  if (errors.length === 0) return null;

  const severityColor: Record<string, string> = {
    critical: 'bg-red-500',
    error: 'bg-orange-500',
    warning: 'bg-yellow-500',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h3 className="text-sm font-bold text-foreground">
            Erros Reportados ({errors.length})
          </h3>
        </div>
        <Badge variant="destructive" className="text-xs">
          Ação necessária
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground">
        Usuários reportaram problemas. Corrija e marque como resolvido para notificar o usuário.
      </p>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        <AnimatePresence>
          {errors.map(err => (
            <motion.div
              key={err.id}
              layout
              exit={{ opacity: 0, height: 0 }}
              className="rounded-lg border border-border bg-card p-3 text-xs space-y-1"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${severityColor[err.severity] || 'bg-gray-400'}`} />
                  <span className="font-medium text-foreground truncate">{err.action_context}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setExpanded(expanded === err.id ? null : err.id)}
                    className="p-1 rounded hover:bg-muted transition-colors"
                    title="Ver detalhes"
                  >
                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => markResolved(err.id)}
                    className="p-1 rounded hover:bg-emerald-500/10 transition-colors"
                    title="Marcar resolvido"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  </button>
                </div>
              </div>

              <p className="text-muted-foreground truncate">{err.error_message}</p>
              <p className="text-muted-foreground/70">
                {err.page_path} • {new Date(err.created_at).toLocaleString('pt-BR')}
              </p>

              {expanded === err.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-2 rounded-lg bg-muted/50 p-2 space-y-1"
                >
                  {err.component_name && <p><strong>Componente:</strong> {err.component_name}</p>}
                  {err.viewport && <p><strong>Tela:</strong> {err.viewport}</p>}
                  <p><strong>Prompt sugerido:</strong></p>
                  <div className="bg-card rounded p-2 font-mono text-[10px] break-all border border-border">
                    Corrija o erro no componente "{err.component_name || 'desconhecido'}" 
                    na página "{err.page_path}" quando o usuário tenta "{err.action_context}". 
                    Erro: "{err.error_message}"
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default AdminErrorAlerts;
