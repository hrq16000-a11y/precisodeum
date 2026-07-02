/**
 * AdminOrphanProfilesPage — Lista usuários autenticados sem profile correspondente
 * e permite reprocessar a criação do profile via RPC admin_reconcile_orphan_profile.
 *
 * Exibe status individual (sucesso/erro) por prestador.
 */
import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { AlertTriangle, RefreshCw, CheckCircle2, XCircle, Loader2, UserX } from 'lucide-react';
import { motion } from 'framer-motion';

interface OrphanRow {
  user_id: string;
  email: string | null;
  created_at: string;
  raw_user_meta_data: any;
  last_sign_in_at: string | null;
}

type RowStatus = 'idle' | 'pending' | 'success' | 'error';

const AdminOrphanProfilesPage = () => {
  const { isAdmin, loading: authLoading } = useAdmin();
  const [orphans, setOrphans] = useState<OrphanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMap, setStatusMap] = useState<Record<string, { status: RowStatus; message?: string }>>({});

  const fetchOrphans = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc('admin_list_orphan_profiles');
      if (error) throw error;
      setOrphans((data ?? []) as OrphanRow[]);
    } catch (err: any) {
      console.error('[OrphanProfiles] list failed', err);
      toast.error('Falha ao carregar perfis órfãos', { description: err?.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    void fetchOrphans();
  }, [isAdmin]);

  const reconcile = async (userId: string) => {
    setStatusMap(prev => ({ ...prev, [userId]: { status: 'pending' } }));
    try {
      const { data, error } = await (supabase as any).rpc('admin_reconcile_orphan_profile', { _user_id: userId });
      if (error) throw error;
      const result = data as { success: boolean; created?: boolean; message?: string; error?: string };
      if (!result?.success) {
        throw new Error(result?.error || 'Falha desconhecida');
      }
      setStatusMap(prev => ({
        ...prev,
        [userId]: {
          status: 'success',
          message: result.created ? 'Profile criado' : (result.message || 'Já existia'),
        },
      }));
      toast.success(result.created ? 'Profile criado com sucesso' : 'Profile já existia');
      // Remove da lista após sucesso
      setTimeout(() => setOrphans(prev => prev.filter(o => o.user_id !== userId)), 1500);
    } catch (err: any) {
      const message = err?.message || 'Erro inesperado';
      setStatusMap(prev => ({ ...prev, [userId]: { status: 'error', message } }));
      toast.error('Falha ao reprocessar', { description: message });
    }
  };

  if (authLoading) return <AdminLayout><p className="text-muted-foreground">Carregando…</p></AdminLayout>;
  if (!isAdmin) return null;

  return (
    <AdminLayout>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
            <UserX className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Perfis Órfãos</h1>
            <p className="text-sm text-muted-foreground">
              Usuários autenticados sem registro em <code className="rounded bg-muted px-1 py-0.5 text-xs">profiles</code>.
              Reprocesse individualmente para reconstruir o vínculo.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchOrphans} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </motion.div>

      <Card className="mt-6 p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Buscando órfãos…
          </div>
        ) : orphans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 className="mb-3 h-10 w-10 text-emerald-500" />
            <p className="font-display text-lg font-bold text-foreground">Nenhum perfil órfão</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Todos os usuários autenticados possuem profile correspondente.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/5 px-4 py-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{orphans.length} usuário(s) sem profile detectado(s)</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Último login</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orphans.map(row => {
                  const st = statusMap[row.user_id] ?? { status: 'idle' as const };
                  return (
                    <TableRow key={row.user_id}>
                      <TableCell className="font-medium">{row.email ?? '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(row.created_at).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.last_sign_in_at ? new Date(row.last_sign_in_at).toLocaleString('pt-BR') : 'Nunca'}
                      </TableCell>
                      <TableCell>
                        {st.status === 'idle' && <Badge variant="outline">Pendente</Badge>}
                        {st.status === 'pending' && (
                          <Badge variant="secondary" className="gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Processando
                          </Badge>
                        )}
                        {st.status === 'success' && (
                          <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            {st.message || 'OK'}
                          </Badge>
                        )}
                        {st.status === 'error' && (
                          <Badge variant="destructive" className="gap-1" title={st.message}>
                            <XCircle className="h-3 w-3" />
                            Erro
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="default"
                          disabled={st.status === 'pending' || st.status === 'success'}
                          onClick={() => reconcile(row.user_id)}
                          className="gap-1.5"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${st.status === 'pending' ? 'animate-spin' : ''}`} />
                          Reprocessar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </>
        )}
      </Card>
    </AdminLayout>
  );
};

export default AdminOrphanProfilesPage;
