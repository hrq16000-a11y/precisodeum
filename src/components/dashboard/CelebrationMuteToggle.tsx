import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { isCelebrationMuted, setCelebrationMuted } from '@/lib/celebrate';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * CelebrationMuteToggle — discreto botão de volume para silenciar/ativar o som
 * 'Ebá!' das conquistas. Persiste no perfil e emite evento global para
 * sincronizar outras instâncias na mesma aba.
 */
const CelebrationMuteToggle = () => {
  const { user, profile, refetchProfile } = useAuth();
  const [muted, setMuted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const profileMuted = !!profile?.celebration_muted;
    setCelebrationMuted(profileMuted);
    setMuted(profileMuted || isCelebrationMuted());
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ muted: boolean }>).detail;
      if (detail) setMuted(detail.muted);
    };
    window.addEventListener('pdu:celebrate-muted-change', handler);
    return () => window.removeEventListener('pdu:celebrate-muted-change', handler);
  }, [profile?.celebration_muted]);

  const toggle = async (next: boolean) => {
    if (!user?.id || saving) return;
    setSaving(true);
    setCelebrationMuted(next);
    setMuted(next);
    const { error } = await supabase.from('profiles').update({ celebration_muted: next } as any).eq('id', user.id);
    if (error) {
      setCelebrationMuted(muted);
      setMuted(muted);
      toast.error('Não foi possível salvar a preferência');
      setSaving(false);
      return;
    }
    await refetchProfile();
    toast.success(next ? 'Sons de conquista silenciados' : 'Sons de conquista ativados');
    setSaving(false);
  };

  return (
    <div className="flex min-w-0 items-center justify-end gap-3 text-right">
      <div className="min-w-0">
        <p className="inline-flex items-center justify-end gap-1.5 text-xs font-semibold text-foreground">
          {muted ? <VolumeX className="h-3.5 w-3.5 text-muted-foreground" /> : <Volume2 className="h-3.5 w-3.5 text-primary" />}
          {muted ? 'Mute ativado' : 'Mute desativado'}
        </p>
        <p className="max-w-[190px] text-[10px] leading-snug text-muted-foreground">
          {muted
            ? 'As próximas conquistas ficam sem som.'
            : 'As próximas conquistas tocam som normalmente.'}
        </p>
      </div>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Switch
              checked={muted}
              onCheckedChange={toggle}
              disabled={saving}
              aria-label={muted ? 'Desativar mute de celebrações' : 'Ativar mute de celebrações'}
              className="shrink-0"
            />
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {muted ? 'Desligue para voltar a ouvir celebrações' : 'Ligue para silenciar celebrações'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export default CelebrationMuteToggle;
