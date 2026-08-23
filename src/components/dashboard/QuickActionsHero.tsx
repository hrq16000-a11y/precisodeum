import { useNavigate } from 'react-router-dom';
import { Sparkles, PlusCircle } from 'lucide-react';

/**
 * Ações Rápidas em destaque no topo do Dashboard do Profissional.
 * Grid 2 colunas no mobile — primeira coisa que o profissional vê.
 */
const QuickActionsHero = () => {
  const navigate = useNavigate();

  return (
    <section
      aria-label="Ações Rápidas"
      className="grid grid-cols-2 gap-3"
    >
      <button
        type="button"
        onClick={() => navigate('/dashboard/portfolio?action=daily-post')}
        className="group flex flex-col items-start gap-2 rounded-2xl border border-border bg-gradient-to-br from-amber-500 to-orange-500 p-6 text-left text-white shadow-xs transition-transform hover:-translate-y-0.5 active:translate-y-0"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
          <Sparkles size={20} strokeWidth={1.5} />
        </div>
        <div>
          <h3 className="text-sm font-bold">Postar Obra do Dia</h3>
          <p className="mt-0.5 text-xs opacity-90">Mostre o que você fez hoje</p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => navigate('/dashboard/servicos?action=new')}
        className="group flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-6 text-left text-foreground shadow-xs transition-transform hover:-translate-y-0.5 active:translate-y-0"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <PlusCircle size={20} strokeWidth={1.5} />
        </div>
        <div>
          <h3 className="text-sm font-bold">Anunciar Novo Serviço</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Adicione à sua vitrine</p>
        </div>
      </button>
    </section>
  );
};

export default QuickActionsHero;
