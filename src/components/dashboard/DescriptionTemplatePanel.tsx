import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Copy, ExternalLink, FileText } from 'lucide-react';
import { toast } from 'sonner';
import {
  getTemplatesForCategory,
  DIFFERENTIAL_TAGS,
  buildExternalPrompt,
} from '@/data/serviceTemplates';

interface Props {
  categorySlugs: string[];
  serviceName: string;
  categoryName?: string;
  cityName?: string;
  onApply: (text: string) => void;
}

const DescriptionTemplatePanel = ({
  categorySlugs,
  serviceName,
  categoryName,
  cityName,
  onApply,
}: Props) => {
  const [open, setOpen] = useState(false);

  const templates = useMemo(() => {
    return categorySlugs.flatMap((s) => getTemplatesForCategory(s));
  }, [categorySlugs]);

  const handleCopyPrompt = () => {
    const prompt = buildExternalPrompt(serviceName || 'meu serviço', categoryName, cityName);
    navigator.clipboard
      .writeText(prompt)
      .then(() => {
        toast.success('Prompt copiado! Cole no ChatGPT ou Gemini.', { duration: 4000 });
      })
      .catch(() => toast.error('Não foi possível copiar'));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
        >
          <FileText className="h-3 w-3" />
          Frases Prontas
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        <span className="text-muted-foreground text-[10px]">•</span>
        <button
          type="button"
          onClick={handleCopyPrompt}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:underline"
        >
          <Copy className="h-3 w-3" /> Copiar Prompt
        </button>
        <a
          href="https://chatgpt.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-accent"
        >
          <ExternalLink className="h-2.5 w-2.5" /> ChatGPT
        </a>
        <a
          href="https://gemini.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-accent"
        >
          <ExternalLink className="h-2.5 w-2.5" /> Gemini
        </a>
      </div>

      {open && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          {templates.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                📝 Modelos para sua categoria
              </p>
              <div className="grid gap-1.5">
                {templates.map((t, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      onApply(t.description);
                      setOpen(false);
                      toast.success(`Modelo "${t.label}" aplicado!`);
                    }}
                    className="text-left rounded-md border border-border bg-card px-3 py-2 hover:border-accent/40 hover:bg-accent/5 transition-colors group"
                  >
                    <span className="text-xs font-medium text-foreground group-hover:text-accent">
                      {t.label}
                    </span>
                    <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                      {t.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              🏷️ Tags de Diferencial
            </p>
            <div className="flex flex-wrap gap-1.5">
              {DIFFERENTIAL_TAGS.map((dt) => (
                <button
                  key={dt.label}
                  type="button"
                  onClick={() => {
                    onApply(dt.value);
                    toast.success(`"${dt.label}" adicionado!`);
                  }}
                  className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-accent/40 hover:bg-accent/5 transition-colors"
                >
                  {dt.label}
                </button>
              ))}
            </div>
          </div>

          {templates.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic">
              Selecione uma categoria para ver modelos específicos, ou use o botão "Copiar Prompt"
              para gerar com IA externa gratuita.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default DescriptionTemplatePanel;
