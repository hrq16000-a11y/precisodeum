import { Link } from 'react-router-dom';
import { Eye, MessageSquare, Send, Sparkles } from 'lucide-react';

interface Props {
  views: number;
  whatsappClicks: number;
  leads: number;
}

const Metric = ({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  value: number;
  label: string;
}) => (
  <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 p-3">
    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
      <Icon size={20} strokeWidth={1.5} />
    </div>
    <div>
      <p className="text-lg font-bold leading-none text-foreground">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
    </div>
  </div>
);

/**
 * "Impacto na Rede" — agrega Views, WhatsApp clicks e Leads.
 * Quando todos os valores são 0, renderiza um Empty State elegante em vez
 * de um gráfico vazio que passe ar de inatividade.
 */
const ImpactSection = ({ views, whatsappClicks, leads }: Props) => {
  const allZero = views === 0 && whatsappClicks === 0 && leads === 0;

  return (
    <section
      aria-label="Impacto na Rede"
      className="rounded-2xl border border-border bg-card p-6 shadow-sm"
    >
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Impacto na Rede</h2>
        <span className="text-[11px] text-muted-foreground">Últimos 30 dias</span>
      </header>

      {allZero ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
            <Sparkles size={20} strokeWidth={1.5} />
          </div>
          <p className="text-sm font-semibold text-foreground">Sua vitrine está pronta.</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Poste uma obra para começar a atrair clientes!
          </p>
          <Link
            to="/dashboard/portfolio?action=daily-post"
            className="mt-1 text-xs font-medium text-accent hover:underline"
          >
            Postar Obra do Dia
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <Metric icon={Eye} value={views} label="Visualizações" />
          <Metric icon={MessageSquare} value={whatsappClicks} label="WhatsApp" />
          <Metric icon={Send} value={leads} label="Solicitações" />
        </div>
      )}
    </section>
  );
};

export default ImpactSection;
