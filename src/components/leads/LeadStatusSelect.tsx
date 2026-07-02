/**
 * LeadStatusSelect — Select de status do lead com captura de "motivo de perda".
 * Quando o usuário escolhe 'lost', abre dialog pedindo o motivo (livre + sugestões).
 * O motivo é gravado em leads.lost_reason; o trigger record_lead_status_change
 * cuida de criar a entrada no histórico com "Motivo: ...".
 */
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateLeadStatus, STATUS_META, type LeadStatus } from '@/hooks/useLeadFollowup';

const STATUS_KEYS: LeadStatus[] = ['new', 'contacted', 'scheduled', 'completed', 'lost'];

const LOST_PRESETS = [
  'Cliente sumiu / não respondeu',
  'Valor combinado fora do que o cliente buscava',
  'Contratou outro profissional',
  'Não era meu serviço',
  'Distância / fora da minha região',
];

interface Props {
  leadId: string;
  currentStatus: LeadStatus;
  onChanged?: (s: LeadStatus) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export default function LeadStatusSelect({ leadId, currentStatus, onChanged, className, size = 'md' }: Props) {
  const updateStatus = useUpdateLeadStatus();
  const [askReason, setAskReason] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  function pickStatus(next: string) {
    const s = next as LeadStatus;
    if (s === currentStatus) return;
    if (s === 'lost') {
      setReason('');
      setAskReason(true);
      return;
    }
    updateStatus.mutate({ leadId, status: s });
    onChanged?.(s);
  }

  async function confirmLost() {
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from('leads')
        .update({ status: 'lost', lost_reason: reason.trim() || null })
        .eq('id', leadId);
      if (error) throw error;
      toast.success('Lead marcado como perdido', {
        description: reason.trim() ? `Motivo: ${reason.trim()}` : 'Sem motivo informado',
      });
      onChanged?.('lost');
      setAskReason(false);
    } catch (e: any) {
      toast.error('Não foi possível salvar', { description: e?.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Select value={currentStatus} onValueChange={pickStatus}>
        <SelectTrigger className={className || (size === 'sm' ? 'h-8 w-44' : 'h-9 w-44')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_KEYS.map(s => (
            <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={askReason} onOpenChange={setAskReason}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Por que esse lead foi perdido?</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Registrar o motivo ajuda você a entender o pipeline ao longo do tempo. Opcional, mas recomendado.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {LOST_PRESETS.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setReason(p)}
                className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
              >
                {p}
              </button>
            ))}
          </div>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Descreva em poucas palavras (opcional)"
            rows={3}
            maxLength={300}
          />
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setAskReason(false)} disabled={saving}>Cancelar</Button>
            <Button variant="outline" onClick={() => { setReason(''); confirmLost(); }} disabled={saving}>
              Marcar sem motivo
            </Button>
            <Button onClick={confirmLost} disabled={saving}>
              {saving ? 'Salvando…' : 'Confirmar perda'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
