import { Link } from '@/lib/router-compat';
import { ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';

/**
 * Faixa de captura de prestador exibida logo abaixo do Hero da Home.
 * Objetivo: converter o profissional que cai na home em cadastro,
 * sem competir com o CTA principal de busca (cliente).
 *
 * Design: clean, 1 título + 3 micro-benefícios + 1 CTA único.
 * Não chama API, não bloqueia render — totalmente estático.
 */
export default function ProSignupStrip() {
  return (
    <section
      aria-label="Cadastro de profissional"
      className="border-y border-border bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5"
    >
      <div className="container mx-auto px-4 py-5 md:py-6">
        <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between md:gap-6">
          <div className="flex items-center gap-3 text-center md:text-left">
            <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 md:flex">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground md:text-lg">
                Você é profissional? Anuncie seus serviços grátis
              </p>
              <p className="mt-0.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground md:justify-start">
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Cadastro em 60s
                </span>
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Receba clientes pelo WhatsApp
                </span>
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Sem mensalidade
                </span>
              </p>
            </div>
          </div>

          <Link
            to="/cadastro?next=/cadastro-inicial"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90 hover:shadow-md"
          >
            Anunciar meu serviço <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
