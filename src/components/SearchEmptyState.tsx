/**
 * SearchEmptyState — Empty/error/loading states para resultados de busca.
 *
 * Variantes:
 *  - "results": query OK, zero resultados → funil "Seja o Mestre" (CTA cadastro)
 *  - "error":   query falhou → CTA "Tentar novamente"
 *  - (loading é renderizado fora — manter skeleton existente)
 */
import { Link } from '@/lib/router-compat';
import { Button } from '@/components/ui/button';
import { Search, RefreshCcw, Sparkles, Bell, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';

interface ResultsProps {
  variant: 'results';
  city?: string;
  categorySlug?: string;
  categoryName?: string;
  query?: string;
}

interface ErrorProps {
  variant: 'error';
  onRetry?: () => void;
}

type Props = ResultsProps | ErrorProps;

export default function SearchEmptyState(props: Props) {
  if (props.variant === 'error') return <ErrorVariant onRetry={props.onRetry} />;
  return <ResultsVariant {...props} />;
}

function ErrorVariant({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-destructive/40 bg-card/50 p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <RefreshCcw className="h-6 w-6 text-destructive" />
      </div>
      <h3 className="font-display text-base font-semibold text-foreground">
        Não conseguimos carregar os resultados
      </h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Verifique sua conexão e tente novamente.
      </p>
      {onRetry && (
        <div className="mt-4 flex justify-center">
          <Button size="sm" onClick={onRetry} className="rounded-full">
            <RefreshCcw className="mr-1.5 h-3.5 w-3.5" /> Tentar novamente
          </Button>
        </div>
      )}
    </div>
  );
}

function ResultsVariant({ city, categorySlug, categoryName, query }: Omit<ResultsProps, 'variant'>) {
  const [notifyOpen, setNotifyOpen] = useState(false);

  const subjectLabel = categoryName || query || 'esse serviço';
  const locationLabel = city ? ` em ${city}` : '';

  const cadastroParams = new URLSearchParams();
  if (categorySlug) cadastroParams.set('categoria', categorySlug);
  if (city) cadastroParams.set('cidade', city);
  cadastroParams.set('origem', 'busca_vazia');
  const cadastroHref = `/cadastro-inicial?${cadastroParams.toString()}`;

  return (
    <div className="rounded-2xl border border-dashed border-border bg-gradient-to-br from-amber-50/50 via-card/50 to-emerald-50/30 p-6 text-center dark:from-amber-950/20 dark:to-emerald-950/10">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
        <Search className="h-6 w-6 text-amber-700 dark:text-amber-300" />
      </div>
      <h3 className="font-display text-base font-bold text-foreground">
        Nenhum profissional encontrado{locationLabel} para {subjectLabel}
      </h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Seja o primeiro a atender essa demanda na sua região e apareça no topo das próximas buscas.
      </p>

      <div className="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row">
        <Button
          asChild
          size="lg"
          className="group h-11 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500 px-6 font-bold text-white shadow-[0_0_18px_rgba(251,146,60,0.4)] hover:opacity-95"
        >
          <Link to={cadastroHref}>
            <Sparkles className="mr-2 h-4 w-4" />
            Cadastrar minha empresa
            <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="rounded-full text-xs"
          onClick={() => setNotifyOpen(true)}
        >
          <Bell className="mr-1.5 h-3.5 w-3.5" />
          Receber aviso quando alguém se cadastrar
        </Button>
      </div>

      {notifyOpen && (
        <NotifyMeForm
          city={city}
          categorySlug={categorySlug}
          query={query}
          onClose={() => setNotifyOpen(false)}
        />
      )}
    </div>
  );
}

function NotifyMeForm({
  city,
  categorySlug,
  query,
  onClose,
}: {
  city?: string;
  categorySlug?: string;
  query?: string;
  onClose: () => void;
}) {
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact.trim()) return;
    setSubmitting(true);
    try {
      // Loga demanda com flag notify=true
      await (supabase as any).from('search_demand_logs').insert({
        query: query || null,
        category_slug: categorySlug || null,
        city: city || null,
        notify: true,
        notify_contact: contact.trim(),
        source: 'empty_state',
      }).catch((err: any) => console.warn('notify demand log failed', err));
      toast.success('Avisaremos assim que um profissional se cadastrar.');
      onClose();
    } catch {
      toast.error('Não conseguimos registrar agora. Tente novamente em instantes.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto mt-4 flex max-w-sm gap-2">
      <input
        type="text"
        inputMode="email"
        autoComplete="email"
        placeholder="Seu e-mail ou WhatsApp"
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        className="flex-1 rounded-full border border-input bg-background px-4 py-2 text-sm outline-hidden focus:border-amber-400 focus:ring-2 focus:ring-amber-300/40"
      />
      <Button type="submit" size="sm" disabled={submitting} className="rounded-full">
        {submitting ? '...' : 'Avisar'}
      </Button>
    </form>
  );
}
