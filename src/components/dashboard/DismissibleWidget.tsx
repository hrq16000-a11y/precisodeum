import { ReactNode } from 'react';
import { X } from 'lucide-react';
import { useDashboardState, IMMUTABLE_WIDGETS } from '@/hooks/useDashboardState';

interface DismissibleWidgetProps {
  /** Chave estável do widget (ex.: 'profile_completeness', 'expert_tips'). */
  widgetKey: string;
  /** Tier mínimo necessário para exibir; opcional. */
  minTier?: 'novato' | 'explorador' | 'ativo' | 'veterano';
  /** Função que verifica gating externo (ex.: useMaturityTier().isAtLeast). */
  gate?: boolean;
  children: ReactNode;
}

/**
 * Wrapper que:
 *  - Esconde o widget se ele estiver na lista `dismissed_widgets` (server-side).
 *  - Esconde se `gate=false`.
 *  - Renderiza um botão X de dispensa, EXCETO para widgets imutáveis.
 *  - Não persiste em localStorage — usa user_dashboard_state.
 */
const DismissibleWidget = ({ widgetKey, gate = true, children }: DismissibleWidgetProps) => {
  const { isWidgetDismissed, dismissWidget } = useDashboardState();
  const immutable = IMMUTABLE_WIDGETS.includes(widgetKey as typeof IMMUTABLE_WIDGETS[number]);

  if (!gate) return null;
  if (!immutable && isWidgetDismissed(widgetKey)) return null;

  return (
    <div className="relative group">
      {!immutable && (
        <button
          onClick={() => dismissWidget(widgetKey)}
          aria-label="Dispensar este card"
          className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity rounded-full bg-background/80 backdrop-blur p-1 text-muted-foreground hover:text-foreground hover:bg-background border border-border/50"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      {children}
    </div>
  );
};

export default DismissibleWidget;
