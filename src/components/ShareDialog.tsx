import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageCircle, Copy, Check, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { whatsappLink } from '@/lib/whatsapp';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  title: string;
  text?: string;
}

/**
 * Diálogo de compartilhamento com 3 opções:
 *  1) WhatsApp (sempre disponível)
 *  2) Copiar para área de transferência (com fallback de execCommand)
 *  3) Seleção manual via <input readOnly autofocus> caso clipboard falhe
 *
 * Seguro em iOS in-app webviews onde navigator.clipboard é bloqueado.
 */
export default function ShareDialog({ open, onOpenChange, url, title, text }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const [clipboardFailed, setClipboardFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const shareText = text || `Confira: ${title}`;
  const waUrl = whatsappLink('', `${shareText}\n${url}`);

  useEffect(() => {
    if (open && clipboardFailed) {
      // foco automático para facilitar Ctrl+A / long-press
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 80);
    }
  }, [open, clipboardFailed]);

  const handleCopy = async () => {
    // Tentativa 1: API moderna
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        toast.success('Link copiado!');
        setTimeout(() => setCopied(false), 2000);
        return;
      } catch {
        /* cai no fallback */
      }
    }
    // Tentativa 2: execCommand legacy
    try {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) {
        setCopied(true);
        toast.success('Link copiado!');
        setTimeout(() => setCopied(false), 2000);
        return;
      }
    } catch {
      /* segue */
    }
    // Tentativa 3: expõe o input para seleção manual
    setClipboardFailed(true);
    toast.message('Selecione e copie manualmente');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" /> Compartilhar
          </DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Button
            asChild
            className="w-full justify-start gap-2 bg-[#25D366] text-white hover:bg-[#1ebe5a]"
            size="lg"
          >
            <a href={waUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-5 w-5" /> Enviar pelo WhatsApp
            </a>
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="w-full justify-start gap-2"
            onClick={handleCopy}
          >
            {copied ? <Check className="h-5 w-5 text-green-600" /> : <Copy className="h-5 w-5" />}
            {copied ? 'Copiado!' : 'Copiar link'}
          </Button>

          {/* Fallback de seleção manual — sempre acessível, destacado quando clipboard falha */}
          <div className={clipboardFailed ? 'space-y-2' : 'space-y-2 opacity-90'}>
            <label className="text-xs text-muted-foreground">
              {clipboardFailed
                ? 'Não foi possível copiar automaticamente. Selecione o link abaixo:'
                : 'Ou selecione manualmente:'}
            </label>
            <Input
              ref={inputRef}
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="font-mono text-xs"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
