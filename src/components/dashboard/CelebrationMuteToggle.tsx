import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { isCelebrationMuted, setCelebrationMuted } from '@/lib/celebrate';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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

  const toggle = async () => {
    if (!user?.id || saving) return;
    const next = !muted;
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
        <p className="text-xs font-semibold text-foreground">
          {muted ? 'Desativado' : 'Ativado'}
        </p>
        <p className="max-w-[190px] text-[10px] leading-snug text-muted-foreground">
          {muted
            ? 'Ao alternar, o som volta nas próximas conquistas.'
            : 'Ao alternar, o som será silenciado e salvo no perfil.'}
        </p>
      </div>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={toggle}
              disabled={saving}
              aria-label={muted ? 'Ativar som de conquistas' : 'Silenciar som de conquistas'}
              aria-pressed={muted}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {muted ? 'Clique para ativar o som de conquistas' : 'Clique para silenciar o som de conquistas'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export default CelebrationMuteToggle;
