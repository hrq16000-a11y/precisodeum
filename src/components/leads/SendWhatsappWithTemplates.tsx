/**
 * SendWhatsappWithTemplates — Botão "Enviar WhatsApp" com menu de modelos.
 *
 * - Mostra o atalho rápido (mensagem padrão) + lista de modelos do usuário.
 * - Substitui {{cliente}}, {{servico}}, {{meu_nome}} antes de abrir o wa.me.
 * - Atalho para abrir o gerenciador de modelos.
 */
import { useMemo } from 'react';
import { ChevronDown, MessageCircle, Settings2 } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { whatsappLink } from '@/lib/whatsapp';
import { renderTemplate, useWhatsappTemplates } from '@/hooks/useWhatsappTemplates';

interface Props {
  phone: string;
  clientName: string;
  serviceNeeded?: string | null;
  myFirstName?: string | null;
  /** Mensagem padrão usada quando nenhum modelo foi escolhido. */
  defaultMessage: string;
  onManageTemplates: () => void;
}

export default function SendWhatsappWithTemplates({
  phone, clientName, serviceNeeded, myFirstName, defaultMessage, onManageTemplates,
}: Props) {
  const { data: templates = [] } = useWhatsappTemplates();

  const vars = useMemo(
    () => ({ cliente: clientName, servico: serviceNeeded, meu_nome: myFirstName }),
    [clientName, serviceNeeded, myFirstName],
  );

  function open(message: string) {
    window.open(whatsappLink(phone, message), '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="inline-flex">
      <a
        href={whatsappLink(phone, defaultMessage)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-9 min-w-[44px] items-center justify-center gap-1 rounded-l-full bg-emerald-500 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600"
        title="Chamar no WhatsApp"
      >
        <MessageCircle className="h-4 w-4" />
        <span className="hidden sm:inline">Chamar</span>
      </a>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex h-9 items-center justify-center rounded-r-full border-l border-emerald-600/50 bg-emerald-500 px-2 text-white shadow-sm transition-colors hover:bg-emerald-600"
          aria-label="Escolher modelo"
        >
          <ChevronDown className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-80 w-72 overflow-y-auto">
          <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Modelos de mensagem
          </DropdownMenuLabel>
          {templates.length === 0 && (
            <div className="px-2 py-3 text-xs text-muted-foreground">
              Nenhum modelo cadastrado.
            </div>
          )}
          {templates.map((t) => {
            const rendered = renderTemplate(t.content, vars);
            return (
              <DropdownMenuItem
                key={t.id}
                onClick={() => open(rendered)}
                className="flex flex-col items-start gap-1 py-2"
              >
                <span className="text-xs font-bold text-foreground">{t.title}</span>
                <span className="line-clamp-2 text-[11px] text-muted-foreground">{rendered}</span>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onManageTemplates} className="gap-2 text-xs font-semibold text-emerald-600">
            <Settings2 className="h-3.5 w-3.5" /> Gerenciar modelos
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
