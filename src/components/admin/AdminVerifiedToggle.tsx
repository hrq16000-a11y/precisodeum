import { useState } from 'react';
import { ShieldCheck, ShieldOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { invalidateTopProfessionalCache } from '@/hooks/useTopProfessional';

interface Props {
  providerId: string;
  userId?: string | null;
  isVerified: boolean;
  verifiedManual?: boolean;
  onChanged?: () => void;
}

/**
 * Botão admin: marcar/desmarcar manualmente o selo "Profissional Top".
 * Chama a RPC `admin_set_provider_verified` que registra autor + motivo no audit_log.
 * Após a ação, marca `verified_manual=true` (a recomputação automática preserva).
 */
const AdminVerifiedToggle = ({ providerId, userId, isVerified, verifiedManual, onChanged }: Props) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (reason.trim().length < 5) {
      toast({ title: 'Motivo obrigatório', description: 'Descreva o motivo (mínimo 5 caracteres).', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('admin_set_provider_verified' as any, {
        _provider_id: providerId,
        _verified: !isVerified,
        _reason: reason.trim(),
      });
      if (error) throw error;
      invalidateTopProfessionalCache(userId || undefined);
      toast({
        title: !isVerified ? 'Selo concedido' : 'Selo removido',
        description: 'Ação registrada no histórico de auditoria.',
      });
      setOpen(false);
      setReason('');
      onChanged?.();
    } catch (e: any) {
      toast({ title: 'Erro ao atualizar selo', description: e?.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        variant={isVerified ? 'outline' : 'default'}
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        {isVerified ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
        {isVerified ? 'Remover Top' : 'Marcar Top'}
        {verifiedManual && <span className="ml-1 rounded bg-amber-500/15 px-1 text-[10px] text-amber-700">manual</span>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isVerified ? 'Remover selo Profissional Top' : 'Conceder selo Profissional Top'}</DialogTitle>
            <DialogDescription>
              Esta ação será registrada no histórico de auditoria com seu nome e o motivo informado. A decisão sobrescreve a recomputação automática.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="verified-reason">Motivo (mínimo 5 caracteres)</Label>
            <Textarea
              id="verified-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={isVerified ? 'Ex.: contato inválido reportado pelos clientes' : 'Ex.: prestador validado manualmente após contato direto'}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminVerifiedToggle;
