import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Mostra um aviso quando o usuário acessa o domínio publicado
 * em uma rota que pode ainda não estar no build live (ex: rotas recém-criadas).
 *
 * Heurística: se host NÃO contém "lovableproject.com" nem "lovable.app/preview",
 * é o domínio publicado. Mostra um banner sugerindo abrir o preview se houver 404.
 */
export default function PreviewBuildNotice() {
  const [dismissed, setDismissed] = useState(false);
  const [info, setInfo] = useState<{ isPublished: boolean; previewUrl: string } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const host = window.location.hostname;
    const isPreview = host.includes('lovableproject.com') || host.startsWith('id-preview--');
    const isPublished = !isPreview;
    const previewUrl = `https://id-preview--fb563505-3961-4289-bd2c-34953c61ff99.lovable.app${window.location.pathname}`;
    setInfo({ isPublished, previewUrl });
    const stored = sessionStorage.getItem('admin-preview-notice-dismissed');
    if (stored === '1') setDismissed(true);
  }, []);

  if (!info?.isPublished || dismissed) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-3 py-2">
      <div className="flex items-start gap-2 text-xs text-amber-900 dark:text-amber-100">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="flex-1">
          <strong>Você está no domínio publicado.</strong> Rotas administrativas adicionadas recentemente podem retornar 404 até que você clique em <em>Publish → Update</em>. Se uma página não abrir, teste primeiro no preview.
          <a href={info.previewUrl} target="_blank" rel="noreferrer" className="ml-2 underline font-medium">Abrir esta rota no preview</a>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0"
          onClick={() => {
            sessionStorage.setItem('admin-preview-notice-dismissed', '1');
            setDismissed(true);
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
