import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { isCelebrationMuted, setCelebrationMuted } from '@/lib/celebrate';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

/**
 * CelebrationMuteToggle — discreto botão de volume para silenciar/ativar o som
 * 'Ebá!' das conquistas. Persiste em localStorage e emite evento global para
 * sincronizar outras instâncias na mesma aba.
 */
const CelebrationMuteToggle = () => {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setMuted(isCelebrationMuted());
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ muted: boolean }>).detail;
      if (detail) setMuted(detail.muted);
    };
    window.addEventListener('pdu:celebrate-muted-change', handler);
    return () => window.removeEventListener('pdu:celebrate-muted-change', handler);
  }, []);

  const toggle = () => {
    const next = !muted;
    setCelebrationMuted(next);
    setMuted(next);
    toast.success(next ? 'Sons de conquista silenciados' : 'Sons de conquista ativados');
  };

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={toggle}
            aria-label={muted ? 'Ativar som de conquistas' : 'Silenciar som de conquistas'}
            aria-pressed={muted}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {muted ? 'Sons de conquista desativados' : 'Som de conquistas ativo (clique para silenciar)'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default CelebrationMuteToggle;
