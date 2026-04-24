import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CalendarClock } from 'lucide-react';

interface Props {
  leadId: string | null;
  defaultDate?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}

const toLocalInput = (iso?: string | null) => {
  const d = iso ? new Date(iso) : new Date(Date.now() + 24 * 3600_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const RescheduleFollowupDialog = ({ leadId, defaultDate, open, onOpenChange, onDone }: Props) => {
  const [when, setWhen] = useState(() => toLocalInput(defaultDate));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!leadId) return;
    const date = new Date(when);
    if (isNaN(date.getTime())) { toast.error('Data inválida'); return; }
    if (date.getTime() <= Date.now()) { toast.error('Escolha uma data futura'); return; }
    setSaving(true);
    const { error } = await (supabase.rpc as any)('reschedule_lead_followup', {
      _lead_id: leadId,
      _next_at: date.toISOString(),
      _note: note.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error('Não foi possível reagendar', { description: error.message }); return; }
    toast.success('Follow-up reagendado');
    onOpenChange(false);
    setNote('');
    onDone?.();
  };

  const quick = (hours: number) => {
    setWhen(toLocalInput(new Date(Date.now() + hours * 3600_000).toISOString()));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" /> Reagendar follow-up</DialogTitle>
          <DialogDescription>Defina manualmente quando este lead deve gerar o próximo lembrete.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {[3, 12, 24, 48, 72].map(h => (
              <Button key={h} variant="outline" size="sm" type="button" onClick={() => quick(h)}>+{h}h</Button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reschedule-when">Data e horário</Label>
            <Input id="reschedule-when" type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reschedule-note">Observação (opcional)</Label>
            <Textarea id="reschedule-note" value={note} onChange={e => setNote(e.target.value)} maxLength={300} placeholder="Ex.: cliente pediu para ligar segunda" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Salvando...' : 'Reagendar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RescheduleFollowupDialog;
